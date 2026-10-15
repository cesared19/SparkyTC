package com.sparkytc.sparkytcservice.dto.attachments

data class AttachmentContentDTO(
    val fileName: String,
    val contentType: String,
    val data: ByteArray
)
