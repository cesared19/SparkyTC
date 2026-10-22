package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.steps.SharedStepDTO
import com.sparkytc.sparkytcservice.dto.steps.SharedStepItemDTO
import com.sparkytc.sparkytcservice.dto.steps.StepResultDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseRunStepDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseStepDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

/** A step of a test case in the Steps format, or a reference to a shared step. */
@Entity(name = "test_case_steps")
class TestCaseStep(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id")
    val testCase: TestCase,

    @Column(name = "position", nullable = false)
    val position: Int,

    @Column(name = "action")
    val action: String? = null,

    @Column(name = "expected")
    val expected: String? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_step_id")
    val sharedStep: SharedStep? = null,
) {
    fun toDTO(): TestCaseStepDTO = TestCaseStepDTO(externalID, action, expected, sharedStep?.toDTO())
}

/** A named list of steps that test cases insert as a block. */
@Entity(name = "shared_steps")
class SharedStep(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @Column(name = "modify_date")
    @UpdateTimestamp
    val modifyDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    val project: WorkspaceProject,

    @Column(name = "name", nullable = false)
    var name: String,

    @OneToMany(mappedBy = "sharedStep")
    @OrderBy("position ASC")
    val items: List<SharedStepItem> = emptyList(),
) {
    fun toDTO(usageCount: Int = 0): SharedStepDTO =
        SharedStepDTO(externalID, name, items.map { SharedStepItemDTO(it.action, it.expected) }, usageCount)
}

@Entity(name = "shared_step_items")
class SharedStepItem(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_step_id")
    val sharedStep: SharedStep,

    @Column(name = "position", nullable = false)
    val position: Int,

    @Column(name = "action", nullable = false)
    val action: String,

    @Column(name = "expected")
    val expected: String?,
)

/** A step copied into a test run when it's created, so later edits of the test case don't change the run. */
@Entity(name = "test_case_run_steps")
class TestCaseRunStep(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_run_id")
    val testCaseRun: TestCaseRun,

    @Column(name = "position", nullable = false)
    val position: Int,

    @Column(name = "action", nullable = false)
    val action: String,

    @Column(name = "expected")
    val expected: String?,

    @Column(name = "shared_step_name")
    val sharedStepName: String? = null,
) {
    fun toDTO(): TestCaseRunStepDTO = TestCaseRunStepDTO(externalID, action, expected, sharedStepName)
}

/** How a step went in one result of a test case. */
@Entity(name = "test_case_result_steps")
class TestCaseResultStep(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_result_id")
    val result: TestCaseResult,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_run_step_id")
    val step: TestCaseRunStep,

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    val status: TestCaseRunStatus?,

    @Column(name = "actual")
    val actual: String?,
) {
    fun toDTO(): StepResultDTO = StepResultDTO(step.externalID, status, actual)
}
