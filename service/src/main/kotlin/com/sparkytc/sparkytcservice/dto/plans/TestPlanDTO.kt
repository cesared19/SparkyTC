package com.sparkytc.sparkytcservice.dto.plans

import java.util.Date
import java.util.UUID

data class TestPlanDTO(
    val testPlanID: UUID,
    val name: String,
    val description: String?,
    // its test cases: those in these sections or the ones nested in them, with any of these labels, or chosen
    val sectionIDs: List<UUID>,
    val labels: List<String>,
    val testCaseIDs: List<UUID>,
    val createdBy: String? = null,
    val updatedBy: String? = null,
    val modifyDate: Date? = null,
)

data class SaveTestPlanDTO(
    val name: String,
    val description: String? = null,
    val sectionIDs: List<UUID> = emptyList(),
    val labels: List<String> = emptyList(),
    val testCaseIDs: List<UUID> = emptyList(),
)
