package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.testruns.TestCaseResultDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

/**
 * One result recorded for a test case in a test run, with its comment and evidence. A test case can be recorded
 * several times in a run (failed, then passed once fixed); the latest result is its status. Results aren't edited.
 */
@Entity(name = "test_case_results")
class TestCaseResult(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_run_id")
    val testCaseRun: TestCaseRun,

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    val status: TestCaseRunStatus,

    @Column(name = "notes")
    val notes: String?,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    val recordedBy: User?,

    @Column(name = "recorded_at", nullable = false)
    val recordedAt: Date = Date(),

    @OneToMany(mappedBy = "testCaseResult")
    @OrderBy("creationDate ASC")
    val attachments: List<TestCaseAttachment> = emptyList(),

    // how each step went, for test cases written as steps
    @OneToMany(mappedBy = "result")
    val stepResults: List<TestCaseResultStep> = emptyList(),

    // the app's token that recorded it through the integration API, instead of a user
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_token_id")
    val recordedByToken: ProjectApiToken? = null,

    // what the app reported with the result (JSON of IntegrationResultReportDTO), e.g. a replay's comparison
    @Column(name = "report")
    val report: String? = null,
) {
    /** Who recorded it: the user, or the app's token as "Name (API token)". */
    val recorderName: String?
        get() = recordedBy?.displayName ?: recordedByToken?.authorName

    fun toDTO(): TestCaseResultDTO {
        return TestCaseResultDTO(
            resultID = externalID,
            status = status,
            notes = notes,
            recordedBy = recorderName,
            recordedByID = recordedBy?.externalID,
            recordedAt = recordedAt,
            attachments = attachments.map { it.toDTO() },
            stepResults = stepResults.sortedBy { it.step.position }.map { it.toDTO() },
            report = report,
        )
    }
}
