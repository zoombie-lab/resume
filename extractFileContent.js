const pdf = require('pdf-parse');
const mammoth = require('mammoth');

async function extractFileContent(file) {
    const buffer = file.buffer;
    const mimeType = file.mimetype;

    try {
        if (mimeType === 'application/pdf') {
            const data = await pdf(buffer);
            return data.text;
        } else if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer: buffer });
            return result.value;
        } else {
            throw new Error('Unsupported file type');
        }
    } catch (error) {
        console.error('Error extracting file content:', error);
        throw error;
    }
}

module.exports = extractFileContent;