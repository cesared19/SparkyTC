package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import jakarta.persistence.*
import java.util.*

/**
 * What a user has marked and written for a test case in a run before saving the result: the chosen result, the
 * comment and how each step went. It's kept as they work, so nothing is lost when they leave the page, and
 * removed when the result is saved.
 */
@Entity(name = "test_case_run_drafts")
class TestCaseRunDraft(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "modify_date")
    var modifyDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_run_id")
    val testCaseRun: TestCaseRun,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    val user: User,

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    var status: TestCaseRunStatus? = null,

    @Column(name = "notes")
    var notes: String? = null,

    // the step results as JSON, a list of StepResultDTO
    @Column(name = "step_results")
    var stepResults: String? = null,
)
