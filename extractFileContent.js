const pdf = require('pdf-parse');
const mammoth = require('mammoth');

async function extractFileContent(file) {
    console.log('Entering extractFileContent function');
    console.log('File details:', {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype
    });

    const buffer = file.buffer;
    const mimeType = file.mimetype;

    try {
        if (mimeType === 'application/pdf') {
            console.log('Extracting content from PDF file');
            const data = await pdf(buffer);
            console.log('PDF content extracted successfully');
            return data.text;
        } else if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log('Extracting content from Word document');
            const result = await mammoth.extractRawText({ buffer: buffer });
            console.log('Word document content extracted successfully');
            return result.value;
        } else {
            console.log('Unsupported file type:', mimeType);
            throw new Error('Unsupported file type');
        }
    } catch (error) {
        console.error('Error in extractFileContent:', error);
        throw error;
    }
}

module.exports = extractFileContent;
