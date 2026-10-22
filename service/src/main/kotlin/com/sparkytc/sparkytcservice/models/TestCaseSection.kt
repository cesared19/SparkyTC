package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.sections.TestCaseSectionDTO
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

/**
 * A folder of test cases. Sections without a parent are the project's suites; sections nest without a limit,
 * and every test case lives in exactly one of them.
 */
@Entity(name = "test_case_sections")
class TestCaseSection(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    val project: WorkspaceProject,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    var parent: TestCaseSection? = null,

    @Column(name = "name", nullable = false)
    var name: String,

    // order among its siblings
    @Column(name = "position", nullable = false)
    var position: Int = 0,
) {
    fun toDTO(): TestCaseSectionDTO {
        return TestCaseSectionDTO(externalID, parent?.externalID, name, position)
    }
}
