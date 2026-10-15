package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.projects.WorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.testcases.TestCaseDTO
import jakarta.persistence.*
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

    @OneToMany(mappedBy = "testCase")
    val propertyValues: List<TestCasePropertyValue> = emptyList(),

    @OneToMany(mappedBy = "testCase")
    @OrderBy("creationDate ASC")
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

        return TestCaseDTO(externalID, creationDate, project.externalID, testCaseNumber, title, description, testInstructions, propertyValueMap, attachments.map { it.toDTO() }, jiraLinks.map { it.toDTO() }, createdBy?.displayName, updatedBy?.displayName, modifyDate)
    }
}