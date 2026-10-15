package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.auth.UserSummaryDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

@Entity(name = "test_case_runs")
class TestCaseRun(
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
    @JoinColumn(name = "test_run_id")
    val testRun: TestRun,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id")
    val testCase: TestCase,

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    var status: TestCaseRunStatus,

    @Column(name = "title")
    var title: String,

    @Column(name = "description")
    var description: String?,

    @Column(name = "test_instructions")
    var testInstructions: String?,

    @Column(name = "notes")
    var notes: String?,

    // the user who last recorded a result for this test case run
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "executed_by_id")
    var executedBy: User? = null,

    // the user working on this test case, so testers don't duplicate work
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_id")
    var assignedTo: User? = null,
) {
    fun toDTO(): TestCaseRunDTO {
        return TestCaseRunDTO(externalID, creationDate, testCase.toDTO(), status, title, description, testInstructions, notes, executedBy?.displayName, assignedTo?.let { UserSummaryDTO(it.externalID, it.displayName) })
    }
}