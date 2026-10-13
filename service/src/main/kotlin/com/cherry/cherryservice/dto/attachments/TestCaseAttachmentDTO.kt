package com.cherry.cherryservice.dto.attachments

import java.util.Date
import java.util.UUID

data class TestCaseAttachmentDTO(
    val attachmentID: UUID,
    val creationDate: Date,
    val fileName: String,
    val contentType: String,
    val fileSize: Long
)
