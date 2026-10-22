package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.projects.WorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.testcases.TestCaseDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseFormat
import jakarta.persistence.*
import org.hibernate.annotations.SQLRestriction
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

@Entity(name = "test_cases")
class TestCase(
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

    @Column(name = "test_case_number")
    val testCaseNumber: Long,

    @Column(name = "title")
    var title: String,

    @Column(name = "description")
    var description: String?,

    @Column(name = "test_instructions")
    var testInstructions: String?,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_id")
    var updatedBy: User? = null,

    // the suite or section it's filed in; always set once saved
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id")
    var section: TestCaseSection? = null,

    // free text instructions, or steps each with its expected result
    @Column(name = "format", nullable = false)
    @Enumerated(EnumType.STRING)
    var format: TestCaseFormat = TestCaseFormat.TEXT,

    @OneToMany(mappedBy = "testCase")
    @OrderBy("position ASC")
    val steps: List<TestCaseStep> = emptyList(),

    // free labels such as smoke or payments, to find test cases across suites
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "test_case_labels", joinColumns = [JoinColumn(name = "test_case_id")])
    @Column(name = "name")
    var labels: MutableSet<String> = mutableSetOf(),

    // deleted while used by test runs: hidden from the project, kept for the runs' results
    @Column(name = "is_archived", nullable = false)
    var isArchived: Boolean = false,

    @OneToMany(mappedBy = "testCase")
    val propertyValues: List<TestCasePropertyValue> = emptyList(),

    // the test case's own attachments, without the evidence of its results
    @OneToMany(mappedBy = "testCase")
    @OrderBy("creationDate ASC")
    @SQLRestriction("test_case_result_id IS NULL")
    val attachments: List<TestCaseAttachment> = emptyList(),

    @OneToMany(mappedBy = "testCase")
    @OrderBy("creationDate ASC")
    val jiraLinks: List<TestCaseJiraLink> = emptyList(),
) {

    fun toDTO(): TestCaseDTO {
        val propertyValueMap = emptyMap<UUID, String>().toMutableMap()
        for (propertyValue in propertyValues) {
            propertyValueMap[propertyValue.propertyConfiguration.externalID] = propertyValue.value
        }

        return TestCaseDTO(externalID, creationDate, project.externalID, testCaseNumber, title, description, testInstructions, propertyValueMap, attachments.map { it.toDTO() }, jiraLinks.map { it.toDTO() }, createdBy?.displayName, updatedBy?.displayName, modifyDate, isArchived, section?.externalID, labels.sortedBy { it.lowercase() }, format, steps.map { it.toDTO() })
    }
}