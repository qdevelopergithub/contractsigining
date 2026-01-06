const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const stream = require('stream');

/**
 * GOOGLE DRIVE SERVICE
 * Handles authentication and file uploads to Google Drive using a Service Account.
 */

const KEYFILEPATH = path.join(__dirname, 'service-account-key.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Support credentials from environment variable (for cloud) or file (for local)
let auth;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });
        console.log('🔐 Drive Auth: Using credentials from environment variable');
    } catch (e) {
        console.error('⚠️ Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    }
}

if (!auth) {
    auth = new google.auth.GoogleAuth({
        keyFile: KEYFILEPATH,
        scopes: SCOPES,
    });
}

const drive = google.drive({ version: 'v3', auth });
(async () => {
    try {
        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        console.log('🔐 Drive Auth Project ID:', projectId);
        console.log('🔐 Service Account Email:', client.email || 'Check service-account-key.json');
    } catch (e) {
        console.error('⚠️ Could not log Drive credentials:', e.message);
    }
})();

/**
 * Uploads a buffer to a specific Google Drive folder.
 * 
 * @param {Buffer} fileBuffer - The content of the file to upload.
 * @param {string} fileName - The name to give the file in Drive.
 * @param {string} folderId - The ID of the Drive folder where the file will be uploaded.
 * @returns {Promise<Object>} - The uploaded file object.
 */
async function uploadToDrive(fileBuffer, fileName, folderId) {
    try {
        console.log(`[DriveService] Attempting to upload file "${fileName}" to Google Drive folder: ${folderId}`);
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: 'application/pdf',
            body: bufferStream,
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
            supportsAllDrives: true, // Crucial for Shared Drives and certain shared folders
        });

        console.log('File uploaded successfully to Google Drive. File ID:', response.data.id);
        return response.data;
    } catch (error) {
        if (error.message.includes('storage quota')) {
            console.error('\n--- GOOGLE DRIVE QUOTA ERROR ---');
            console.error('The Service Account does not have permission to use your storage.');
            console.error('FIX: Share your folder (ID: ' + folderId + ') with the service account email as an EDITOR.');
            console.error('Check your service-account-key.json for the exact "client_email".');
            console.error('--------------------------------\n');
        }
        throw error;
    }
}

module.exports = { uploadToDrive };
