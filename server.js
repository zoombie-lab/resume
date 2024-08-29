const express = require('express');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const { OpenAI } = require('openai');
const extractFileContent = require('./extractFileContent.js'); // Import the new function


const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up storage for multer (file uploads)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Increased limit to 10MB for larger files
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.mimetype)) {
            const error = new Error('Invalid file type');
            error.code = 'INVALID_FILE_TYPE';
            return cb(error, false);
        }
        cb(null, true);
    }
});

// Endpoint to handle the form data
app.post('/api/upload', upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'coverLetter', maxCount: 1 }]), async (req, res) => {
    try {
        // Extract files and data from the form
        const resumeFile = req.files['resume'] ? req.files['resume'][0] : null;
        const coverLetterFile = req.files['coverLetter'] ? req.files['coverLetter'][0] : null;
        const jobDescription = req.body.jobDescription;

        // Validate that required files are present
        if (!resumeFile || !coverLetterFile || !jobDescription) {
            return res.status(400).json({ error: 'Missing required files or job description' });
        }

        // Extract file contents
        const resumeContent = await extractFileContent(resumeFile);
        const coverLetterContent = await extractFileContent(coverLetterFile);

        // Prepare data for OpenAI API
        const prompt = `Analyze the following resume and cover letter for the given job description:

Resume:
${resumeContent}

Cover Letter:
${coverLetterContent}

Job Description:
${jobDescription}

Please provide an analysis of the candidate's suitability for the job, highlighting strengths and potential areas for improvement.`;

        // Send request to OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Choose an appropriate model
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000 // Adjust as needed
        });

        // Extract the response
        const analysis = completion.choices[0].message.content;

        // Send the analysis back to the client
        res.json({ message: 'Analysis complete', analysis: analysis });

    } catch (error) {
        console.error('Error processing upload or OpenAI request:', error);
        res.status(500).json({ error: 'Failed to process upload or generate analysis.' });
    }
});

// Error handling middleware (unchanged)

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
