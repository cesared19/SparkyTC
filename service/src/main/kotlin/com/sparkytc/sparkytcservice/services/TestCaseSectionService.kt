package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.sections.CreateTestCaseSectionDTO
import com.sparkytc.sparkytcservice.dto.sections.ReorderTestCaseSectionDTO
import com.sparkytc.sparkytcservice.dto.sections.TestCaseSectionDTO
import com.sparkytc.sparkytcservice.dto.sections.UpdateTestCaseSectionDTO
import com.sparkytc.sparkytcservice.models.TestCaseSection
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.TestCaseRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseSectionRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.UUID

/** The suites and nested sections that file a project's test cases. */
@Service
class TestCaseSectionService(
    private val sectionRepository: TestCaseSectionRepository,
    private val testCaseRepository: TestCaseRepository,
    private val projectRepository: WorkspaceProjectRepository,
    private val projectAccessService: ProjectAccessService,
) {
    @Transactional
    fun retrieveSections(projectShortCode: String): List<TestCaseSectionDTO> {
        val project = accessibleProject(projectShortCode)
        defaultSection(project)
        return sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project).map { it.toDTO() }
    }

    @Transactional
    fun createSection(projectShortCode: String, request: CreateTestCaseSectionDTO): TestCaseSectionDTO {
        val project = accessibleProject(projectShortCode)
        val parent = request.parentID?.let { requireSection(project, it) }
        val section = TestCaseSection(
            project = project,
            parent = parent,
            name = requireName(request.name),
            position = siblings(project, parent).size,
        )
        return sectionRepository.save(section).toDTO()
    }

    /** Renames a section and moves it under another one, or to the top level as a suite. */
    @Transactional
    fun updateSection(sectionID: UUID, request: UpdateTestCaseSectionDTO): TestCaseSectionDTO {
        val section = accessibleSection(sectionID)
        val project = section.project
        section.name = requireName(request.name)

        val parent = request.parentID?.let { requireSection(project, it) }
        if (parent?.id != section.parent?.id) {
            var ancestor = parent
            while (ancestor != null) {
                require(ancestor.id != section.id) { "A section can't be moved inside itself" }
                ancestor = ancestor.parent
            }
            val oldParent = section.parent
            section.parent = parent
            section.position = siblings(project, parent).count { it.id != section.id }
            sectionRepository.save(section)
            renumber(project, oldParent)
        }
        return sectionRepository.save(section).toDTO()
    }

    /** Moves a section one place up or down among its siblings. */
    @Transactional
    fun reorderSection(sectionID: UUID, request: ReorderTestCaseSectionDTO): List<TestCaseSectionDTO> {
        val section = accessibleSection(sectionID)
        val siblings = siblings(section.project, section.parent).toMutableList()
        val index = siblings.indexOfFirst { it.id == section.id }
        val target = when (request.direction) {
            "up" -> index - 1
            "down" -> index + 1
            else -> throw IllegalArgumentException("The direction must be up or down")
        }
        if (target in siblings.indices) {
            siblings.add(target, siblings.removeAt(index))
            siblings.forEachIndexed { position, sibling -> sibling.position = position }
            sectionRepository.saveAll(siblings)
        }
        return sectionRepository.findAllByProjectOrderByPositionAscIdAsc(section.project).map { it.toDTO() }
    }

    /**
     * Deletes an empty section. Archived test cases left in it, which only test runs show, move to its parent or
     * the first suite. The last suite of a project can't be deleted.
     */
    @Transactional
    fun deleteSection(sectionID: UUID) {
        val section = accessibleSection(sectionID)
        val project = section.project
        val all = sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project)
        require(all.none { it.parent?.id == section.id }) { "Move or delete its sections first" }
        val testCases = testCaseRepository.findAllBySection(section)
        require(testCases.all { it.isArchived }) { "Move its test cases to another section first" }
        require(section.parent != null || all.count { it.parent == null } > 1) { "A project needs at least one suite" }

        val destination = section.parent ?: all.first { it.parent == null && it.id != section.id }
        testCases.forEach { it.section = destination }
        testCaseRepository.saveAll(testCases)
        sectionRepository.delete(section)
        sectionRepository.flush()
        renumber(project, section.parent)
    }

    /** The section a test case is filed in: the chosen one, or the project's first suite, created if needed. */
    fun sectionFor(project: WorkspaceProject, sectionID: UUID?): TestCaseSection {
        return sectionID?.let { requireSection(project, it) } ?: defaultSection(project)
    }

    /** The section at a path such as "Mobile / Login", creating the suite and sections that don't exist yet. */
    fun sectionForPath(project: WorkspaceProject, path: String): TestCaseSection {
        val names = path.split("/").map { it.trim() }.filter { it.isNotEmpty() }
        require(names.isNotEmpty()) { "The section path is empty" }
        var parent: TestCaseSection? = null
        for (name in names) {
            val siblings = siblings(project, parent)
            parent = siblings.firstOrNull { it.name.equals(name, ignoreCase = true) }
                ?: sectionRepository.save(TestCaseSection(project = project, parent = parent, name = requireName(name), position = siblings.size))
        }
        return parent!!
    }

    private fun defaultSection(project: WorkspaceProject): TestCaseSection {
        return siblings(project, null).firstOrNull()
            ?: sectionRepository.save(TestCaseSection(project = project, name = "Default"))
    }

    private fun requireSection(project: WorkspaceProject, sectionID: UUID): TestCaseSection {
        val section = sectionRepository.findByExternalID(sectionID)
        require(section != null && section.project.id == project.id) { "No section found with id $sectionID" }
        return section
    }

    private fun siblings(project: WorkspaceProject, parent: TestCaseSection?): List<TestCaseSection> {
        return sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project).filter { it.parent?.id == parent?.id }
    }

    private fun renumber(project: WorkspaceProject, parent: TestCaseSection?) {
        val siblings = siblings(project, parent)
        siblings.forEachIndexed { position, sibling -> sibling.position = position }
        sectionRepository.saveAll(siblings)
    }

    private fun requireName(name: String): String {
        val trimmed = name.trim()
        require(trimmed.isNotEmpty()) { "The section needs a name" }
        require(trimmed.length <= 200) { "The name must be at most 200 characters" }
        return trimmed
    }

    private fun accessibleProject(projectShortCode: String): WorkspaceProject {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found for id $projectShortCode" }
        projectAccessService.requireAccess(project)
        return project
    }

    private fun accessibleSection(sectionID: UUID): TestCaseSection {
        val section = sectionRepository.findByExternalID(sectionID)
        requireNotNull(section) { "No section found with id $sectionID" }
        projectAccessService.requireAccess(section.project)
        return section
    }
}
