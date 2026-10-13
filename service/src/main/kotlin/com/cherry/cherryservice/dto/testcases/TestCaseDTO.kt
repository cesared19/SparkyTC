package com.cherry.cherryservice.dto.testcases

import com.cherry.cherryservice.dto.attachments.TestCaseAttachmentDTO
import java.util.Date
import java.util.UUID

data class TestCaseDTO(
    val testCaseID: UUID,
    val creationDate: Date,
    val projectID: UUID,
    val testCaseNumber: Long,
    val title: String,
    val description: String?,
    val testInstructions: String?,
    val propertyValues: Map<UUID, String>,
    val attachments: List<TestCaseAttachmentDTO> = emptyList()
)