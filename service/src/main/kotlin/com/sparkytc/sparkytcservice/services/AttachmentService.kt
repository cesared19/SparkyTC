package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.attachments.TestCaseAttachmentDTO
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseAttachment
import com.sparkytc.sparkytcservice.models.TestCaseAttachmentContent
import com.sparkytc.sparkytcservice.models.TestCaseResult
import com.sparkytc.sparkytcservice.repositories.TestCaseAttachmentContentRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseAttachmentRepository
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

/** Stores images and videos in the database, for a test case or as the evidence of one of its results. */
@Service
class AttachmentService(
    private val testCaseAttachmentRepository: TestCaseAttachmentRepository,
    private val testCaseAttachmentContentRepository: TestCaseAttachmentContentRepository,
) {
    fun store(testCase: TestCase, files: List<MultipartFile>, result: TestCaseResult? = null): List<TestCaseAttachmentDTO> {
        require(files.isNotEmpty()) { "At least one file is required" }

        return files.map { file ->
            val fileName = file.originalFilename?.takeIf { it.isNotBlank() } ?: "attachment"
            val contentType = file.contentType ?: ""
            require(isSupportedMediaType(contentType)) { "Unsupported file type for $fileName, only images and videos are allowed" }
            require(!file.isEmpty) { "File $fileName is empty" }

            val attachment = TestCaseAttachment(
                testCase = testCase,
                fileName = fileName,
                contentType = contentType,
                fileSize = file.size,
                uploadedBy = CurrentUser.get(),
                testCaseResult = result,
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
}
