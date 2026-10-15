package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.notifications.NotificationListDTO
import com.sparkytc.sparkytcservice.dto.notifications.NotificationType
import com.sparkytc.sparkytcservice.models.Notification
import com.sparkytc.sparkytcservice.models.TestRun
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.repositories.NotificationRepository
import com.sparkytc.sparkytcservice.repositories.UserRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class NotificationService(
    private val notificationRepository: NotificationRepository,
    private val userRepository: UserRepository,
    private val projectAccessService: ProjectAccessService,
) {
    @Transactional
    fun retrieveNotifications(user: User): NotificationListDTO {
        return NotificationListDTO(
            unreadCount = notificationRepository.countByUserAndIsReadFalse(user),
            notifications = notificationRepository.findTop30ByUserOrderByCreationDateDesc(user).map { it.toDTO() },
        )
    }

    @Transactional
    fun markRead(user: User, notificationID: UUID) {
        val notification = notificationRepository.findByExternalIDAndUser(notificationID, user)
        requireNotNull(notification) { "No notification found with id $notificationID" }
        notification.isRead = true
        notificationRepository.save(notification)
    }

    @Transactional
    fun markAllRead(user: User) {
        notificationRepository.markAllRead(user)
    }

    /** Notifies users who were just assigned to a test run, skipping whoever made the change. */
    fun notifyTestRunAssigned(testRun: TestRun, users: Collection<User>, actor: User?) {
        for (user in users) {
            if (user.id == actor?.id || !user.isActive || !user.notifyTestRunAssigned) continue
            notificationRepository.save(Notification(
                user = user,
                type = NotificationType.TEST_RUN_ASSIGNED,
                title = "Assigned to test run #${testRun.testRunNumber}",
                message = "${actor?.displayName ?: "Someone"} assigned you to \"${testRun.title}\" in ${testRun.project.title}",
                link = testRunLink(testRun),
            ))
        }
    }

    /** Notifies every user that can see the project that a test run finished. */
    fun notifyTestRunCompleted(testRun: TestRun) {
        val recipients = userRepository.findAll().filter {
            it.isActive && it.notifyTestRunCompleted && projectAccessService.canAccess(it, testRun.project)
        }
        for (user in recipients) {
            notificationRepository.save(Notification(
                user = user,
                type = NotificationType.TEST_RUN_COMPLETED,
                title = "Test run #${testRun.testRunNumber} completed",
                message = "\"${testRun.title}\" in ${testRun.project.title} is complete",
                link = testRunLink(testRun),
            ))
        }
    }

    fun notifyJiraIssueFailed(user: User, testRun: TestRun, testCaseTitle: String, error: String) {
        notificationRepository.save(Notification(
            user = user,
            type = NotificationType.JIRA_ISSUE_FAILED,
            title = "Jira issue not created",
            message = "\"$testCaseTitle\" failed but its Jira issue couldn't be created: $error",
            link = testRunLink(testRun),
        ))
    }

    private fun testRunLink(testRun: TestRun) = "/test-runs/${testRun.project.projectShortCode}/${testRun.testRunNumber}"
}
