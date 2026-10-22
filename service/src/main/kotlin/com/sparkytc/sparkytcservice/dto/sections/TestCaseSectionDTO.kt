package com.sparkytc.sparkytcservice.dto.sections

import java.util.UUID

data class TestCaseSectionDTO(
    val sectionID: UUID,
    // empty for suites
    val parentID: UUID?,
    val name: String,
    val position: Int,
)

data class CreateTestCaseSectionDTO(
    val name: String,
    // empty to create a suite
    val parentID: UUID? = null,
)

data class UpdateTestCaseSectionDTO(
    val name: String,
    // empty to make it a suite
    val parentID: UUID? = null,
)

data class ReorderTestCaseSectionDTO(
    // "up" or "down" among its siblings
    val direction: String,
)


