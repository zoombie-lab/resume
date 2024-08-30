const express = require('express');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const { OpenAI } = require('openai');
const extractFileContent = require('./extractFileContent.js');
require('dotenv').config();
const cors = require('cors');
const docx = require('docx');
const { Document, Paragraph, Packer } = docx;

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Set up storage for multer (file uploads)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
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
        const prompt = `Based on the following resume, cover letter, and job description, create an improved resume and a tailored cover letter. Clearly separate the two with "===RESUME===" before the resume and "===COVER LETTER===" before the cover letter. 
        If there are no resume or cover letter provided, please generate both resume and cover letter that's most suitable for the job description at hand. Remember to clearly separate the two with "===RESUME===" and "===COVER LETTER===" as per your instructions.
        Also, use human-natural sounding language in your writing. Do not sound like an AI model writing!

Resume:
${resumeContent}

Cover Letter:
${coverLetterContent}

Job Description:
${jobDescription}

Please provide an improved resume and a tailored cover letter.`;

        // Send request to OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-4", // Ensure correct model name
            messages: [{ role: "user", content: prompt }],
            max_tokens: 3000 // Adjust as needed
        });

        // Extract the response
        const fullResponse = completion.choices[0].message.content;

        // Split the response into resume and cover letter
        const [resumeContentNew, coverLetterContentNew] = fullResponse.split('===COVER LETTER===').map(content => content.trim());

        // Function to create a DOCX document
        const createDocx = (content) => {
            return new Document({
                sections: [{
                    properties: {},
                    children: content.split('\n').filter(para => para.trim() !== '').map(para => new Paragraph({ text: para }))
                }]
            });
        };

        // Create DOCX documents
        const resumeDoc = createDocx(resumeContentNew.replace('===RESUME===', '').trim());
        const coverLetterDoc = createDocx(coverLetterContentNew);

        // Generate buffers
        const resumeBuffer = await Packer.toBuffer(resumeDoc);
        const coverLetterBuffer = await Packer.toBuffer(coverLetterDoc);

        // Send the buffers back to the client
        res.json({ 
            message: 'Documents generated successfully',
            resumeBuffer: resumeBuffer.toString('base64'),
            coverLetterBuffer: coverLetterBuffer.toString('base64')
        });

    } catch (error) {
        console.error('Error processing upload or OpenAI request:', error);
        res.status(500).json({ error: 'Failed to process upload or generate documents.' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: 'Invalid file type. Please upload PDF, DOC, or DOCX files only.' });
    }
    res.status(500).json({ error: 'An internal server error occurred.' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

