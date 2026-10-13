package com.cherry.cherryservice.dto.attachments

data class AttachmentContentDTO(
    val fileName: String,
    val contentType: String,
    val data: ByteArray
)
