/**
 * Storage Service — MinIO (S3-compatible) for resume and file storage.
 * Handles bucket initialization, file upload, download, and presigned URLs.
 */
const Minio = require('minio');
const config = require('../config/env');
const logger = require('../utils/logger');

const minioClient = new Minio.Client({
  endPoint: config.minioEndpoint,
  port: config.minioPort,
  useSSL: config.minioUseSSL,
  accessKey: config.minioAccessKey,
  secretKey: config.minioSecretKey,
});

const BUCKET = config.minioBucket;

/**
 * Ensure the bucket exists; create it if it doesn't.
 */
async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET);
      logger.info(`MinIO bucket "${BUCKET}" created`);
    }
  } catch (err) {
    logger.error('MinIO ensureBucket failed', { err: err.message });
    throw err;
  }
}

/**
 * Upload a file buffer to MinIO.
 * @param {string} objectKey — unique key for the object (e.g., "resumes/userId_timestamp.pdf")
 * @param {Buffer} buffer — file data
 * @param {string} contentType — MIME type (e.g., "application/pdf")
 * @param {object} metadata — optional metadata headers
 * @returns {Promise<string>} — the object key
 */
async function uploadFile(objectKey, buffer, contentType = 'application/pdf', metadata = {}) {
  await ensureBucket();
  await minioClient.putObject(BUCKET, objectKey, buffer, buffer.length, {
    'Content-Type': contentType,
    ...metadata,
  });
  logger.info('File uploaded to MinIO', { objectKey, size: buffer.length });
  return objectKey;
}

/**
 * Get a readable stream for a file from MinIO.
 * @param {string} objectKey
 * @returns {Promise<import('stream').Readable>}
 */
async function getFileStream(objectKey) {
  return minioClient.getObject(BUCKET, objectKey);
}

/**
 * Generate a presigned URL for temporary access to a file.
 * @param {string} objectKey
 * @param {number} expirySeconds — URL validity in seconds (default: 1 hour)
 * @returns {Promise<string>}
 */
async function getPresignedUrl(objectKey, expirySeconds = 3600) {
  return minioClient.presignedGetObject(BUCKET, objectKey, expirySeconds);
}

/**
 * Delete a file from MinIO.
 * @param {string} objectKey
 */
async function deleteFile(objectKey) {
  try {
    await minioClient.removeObject(BUCKET, objectKey);
    logger.info('File deleted from MinIO', { objectKey });
  } catch (err) {
    logger.warn('MinIO deleteFile failed', { objectKey, err: err.message });
  }
}

/**
 * Check if a file exists in MinIO.
 * @param {string} objectKey
 * @returns {Promise<boolean>}
 */
async function fileExists(objectKey) {
  try {
    await minioClient.statObject(BUCKET, objectKey);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ensureBucket,
  uploadFile,
  getFileStream,
  getPresignedUrl,
  deleteFile,
  fileExists,
};
