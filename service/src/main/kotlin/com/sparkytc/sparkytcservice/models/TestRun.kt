package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.auth.UserSummaryDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestRunStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

@Entity(name = "test_runs")
class TestRun (
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

    @Column(name = "test_run_number")
    val testRunNumber: Long,

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    var status: TestRunStatus,

    @Column(name = "title")
    var title: String,

    @Column(name = "description")
    var description: String?,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null,

    // users responsible for executing the test run
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "test_run_assignees",
        joinColumns = [JoinColumn(name = "test_run_id")],
        inverseJoinColumns = [JoinColumn(name = "user_id")]
    )
    val assignees: MutableSet<User> = mutableSetOf(),
) {
    val isClosed: Boolean
        get() = status == TestRunStatus.COMPLETE || status == TestRunStatus.ABORT

    fun toDTO(): TestRunDTO {
        val assigneeSummaries = assignees.sortedBy { it.displayName.lowercase() }.map { UserSummaryDTO(it.externalID, it.displayName) }
        return TestRunDTO(externalID, creationDate, testRunNumber, status, title, description, createdBy?.displayName, assigneeSummaries)
    }
}