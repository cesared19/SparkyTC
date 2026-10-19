package com.sparkytc.sparkytcservice.dto.testcases

import com.sparkytc.sparkytcservice.dto.attachments.TestCaseAttachmentDTO
import com.fasterxml.jackson.annotation.JsonProperty
import com.sparkytc.sparkytcservice.dto.jira.JiraLinkDTO
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
    val modifyDate: Date? = null,
    @JsonProperty("isArchived")
    val isArchived: Boolean = false
)