package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.attachments.TestCaseAttachmentDTO
import com.sparkytc.sparkytcservice.models.ProjectApiToken
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseAttachment
import com.sparkytc.sparkytcservice.models.TestCaseAttachmentContent
import com.sparkytc.sparkytcservice.models.TestCaseResult
import com.sparkytc.sparkytcservice.repositories.TestCaseAttachmentContentRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseAttachmentRepository
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

/**
 * Stores images and videos in the database, for a test case or as the evidence of one of its results. Apps can also
 * attach .zip files to results through the integration API; those are only ever downloaded (see [isShownInline]).
 */
@Service
class AttachmentService(
    private val testCaseAttachmentRepository: TestCaseAttachmentRepository,
    private val testCaseAttachmentContentRepository: TestCaseAttachmentContentRepository,
) {
    fun store(
        testCase: TestCase,
        files: List<MultipartFile>,
        result: TestCaseResult? = null,
        token: ProjectApiToken? = null,
    ): List<TestCaseAttachmentDTO> {
        require(files.isNotEmpty()) { "At least one file is required" }
        // only an app's evidence can be a .zip, e.g. a replay's full report
        val allowZip = token != null && result != null

        // check every file before storing any, so a bad one leaves nothing half uploaded
        val checked = files.map { file ->
            val fileName = file.originalFilename?.substringAfterLast('/')?.substringAfterLast('\\')?.takeIf { it.isNotBlank() } ?: "attachment"
            require(!file.isEmpty) { "File $fileName is empty" }
            val declared = file.contentType?.substringBefore(';')?.trim()?.lowercase().orEmpty()
            val contentType = when {
                allowZip && (declared in ZIP_TYPES || fileName.lowercase().endsWith(".zip")) -> {
                    require(fileName.lowercase().endsWith(".zip") && isZip(file.bytes)) { "File $fileName isn't a .zip file" }
                    ZIP
                }
                isSupportedMediaType(declared) -> declared
                allowZip -> throw IllegalArgumentException("Unsupported file type for $fileName, only images, videos and .zip files are allowed")
                else -> throw IllegalArgumentException("Unsupported file type for $fileName, only images and videos are allowed")
            }
            Triple(file, fileName, contentType)
        }

        return checked.map { (file, fileName, contentType) ->
            val attachment = TestCaseAttachment(
                testCase = testCase,
                fileName = fileName,
                contentType = contentType,
                fileSize = file.size,
                uploadedBy = if (token == null) CurrentUser.get() else null,
                testCaseResult = result,
                uploadedByToken = token,
            )
            testCaseAttachmentRepository.save(attachment)
            testCaseAttachmentContentRepository.save(TestCaseAttachmentContent(attachment = attachment, data = file.bytes))
            attachment.toDTO()
        }
    }

    fun delete(attachment: TestCaseAttachment) {
        testCaseAttachmentContentRepository.deleteAllByAttachment(attachment)
        testCaseAttachmentRepository.delete(attachment)
    }

    private fun isSupportedMediaType(contentType: String): Boolean {
        return contentType.startsWith("image/") || contentType.startsWith("video/")
    }

    // local file header, or the end record of an empty archive
    private fun isZip(bytes: ByteArray) = bytes.size >= 4 && bytes[0] == 'P'.code.toByte() && bytes[1] == 'K'.code.toByte() &&
        ((bytes[2] == 3.toByte() && bytes[3] == 4.toByte()) || (bytes[2] == 5.toByte() && bytes[3] == 6.toByte()))

    companion object {
        const val ZIP = "application/zip"
        private val ZIP_TYPES = setOf(ZIP, "application/x-zip-compressed", "application/x-zip", "application/octet-stream")
        // shown in the browser; anything else (SVG, which can hold scripts, or a .zip) is only downloaded
        private val INLINE_IMAGES = setOf("image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/avif")

        fun isShownInline(contentType: String): Boolean {
            val type = contentType.substringBefore(';').trim().lowercase()
            return type in INLINE_IMAGES || type.startsWith("video/")
        }
    }
}
