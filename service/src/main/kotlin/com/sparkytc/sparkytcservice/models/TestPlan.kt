package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.plans.TestPlanDTO
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

/**
 * A template of test cases to run again and again, e.g. a regression for every build. Its test cases are those
 * in the chosen sections (and the sections nested in them), those with any of the chosen labels, and the ones
 * chosen one by one; they're worked out when the plan is used, so new test cases that match are included.
 */
@Entity(name = "test_plans")
class TestPlan(
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

    @Column(name = "description")
    var description: String? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    val createdBy: User? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_id")
    var updatedBy: User? = null,

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "test_plan_sections",
        joinColumns = [JoinColumn(name = "test_plan_id")],
        inverseJoinColumns = [JoinColumn(name = "section_id")]
    )
    var sections: MutableSet<TestCaseSection> = mutableSetOf(),

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "test_plan_labels", joinColumns = [JoinColumn(name = "test_plan_id")])
    @Column(name = "name")
    var labels: MutableSet<String> = mutableSetOf(),

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "test_plan_test_cases",
        joinColumns = [JoinColumn(name = "test_plan_id")],
        inverseJoinColumns = [JoinColumn(name = "test_case_id")]
    )
    var testCases: MutableSet<TestCase> = mutableSetOf(),
) {
    fun toDTO(): TestPlanDTO {
        return TestPlanDTO(
            testPlanID = externalID,
            name = name,
            description = description,
            sectionIDs = sections.map { it.externalID },
            labels = labels.sortedBy { it.lowercase() },
            testCaseIDs = testCases.map { it.externalID },
            createdBy = createdBy?.displayName,
            updatedBy = updatedBy?.displayName,
            modifyDate = modifyDate,
        )
    }
}
