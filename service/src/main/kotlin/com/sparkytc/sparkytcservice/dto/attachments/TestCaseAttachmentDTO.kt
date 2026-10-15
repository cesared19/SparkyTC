package com.sparkytc.sparkytcservice.dto.attachments

import java.util.Date
import java.util.UUID

data class TestCaseAttachmentDTO(
    val attachmentID: UUID,
    val creationDate: Date,
    val fileName: String,
    val contentType: String,
    val fileSize: Long,
    val uploadedBy: String? = null
)
