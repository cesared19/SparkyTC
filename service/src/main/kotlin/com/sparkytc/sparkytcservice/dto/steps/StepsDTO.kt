package com.sparkytc.sparkytcservice.dto.steps

import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import java.util.UUID

/** How a test case describes what to do: free text, or steps each with its expected result. */
enum class TestCaseFormat {
    TEXT,
    STEPS,
}

/** A step of a test case: its own action and expected result, or a shared step inserted as a block. */
data class TestCaseStepDTO(
    val stepID: UUID,
    val action: String?,
    val expected: String?,
    val sharedStep: SharedStepDTO? = null,
)

/** A step sent when saving a test case: an action and expected result, or the id of a shared step. */
data class StepInputDTO(
    val action: String? = null,
    val expected: String? = null,
    val sharedStepID: UUID? = null,
)

/** Steps reused by several test cases, e.g. "Sign in"; editing them updates every test case that uses them. */
data class SharedStepDTO(
    val sharedStepID: UUID,
    val name: String,
    val items: List<SharedStepItemDTO>,
    // test cases that use it
    val usageCount: Int = 0,
)

data class SharedStepItemDTO(
    val action: String,
    val expected: String?,
)

data class SaveSharedStepDTO(
    val name: String,
    val items: List<SharedStepItemDTO>,
)

/** A step as copied into a test run, with shared steps already expanded. */
data class TestCaseRunStepDTO(
    val stepID: UUID,
    val action: String,
    val expected: String?,
    // set for the steps that came from a shared step
    val sharedStepName: String? = null,
)

/** How a step went in one result. */
data class StepResultDTO(
    val stepID: UUID,
    val status: TestCaseRunStatus?,
    val actual: String?,
)
