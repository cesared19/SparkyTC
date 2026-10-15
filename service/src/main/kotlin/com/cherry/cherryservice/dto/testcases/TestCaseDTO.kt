package com.cherry.cherryservice.dto.testcases

import com.cherry.cherryservice.dto.attachments.TestCaseAttachmentDTO
import com.cherry.cherryservice.dto.jira.JiraLinkDTO
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
    val attachments: List<TestCaseAttachmentDTO> = emptyList(),
    val jiraLinks: List<JiraLinkDTO> = emptyList(),
    val createdBy: String? = null,
    val updatedBy: String? = null,
    val modifyDate: Date? = null
)