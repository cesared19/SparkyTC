package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.notifications.ExternalNotificationDTO
import com.sparkytc.sparkytcservice.dto.notifications.ExternalNotificationResultDTO
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

    @Transactional
    fun deleteNotification(user: User, notificationID: UUID) {
        val notification = notificationRepository.findByExternalIDAndUser(notificationID, user)
        requireNotNull(notification) { "No notification found with id $notificationID" }
        require(notification.isRead) { "Only read notifications can be deleted" }
        notificationRepository.delete(notification)
    }

    @Transactional
    fun deleteAllRead(user: User) {
        notificationRepository.deleteAllRead(user)
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

    fun notifyJiraReporterNotSet(user: User, testRun: TestRun, issueKey: String, error: String) {
        notificationRepository.save(Notification(
            user = user,
            type = NotificationType.JIRA_REPORTER_NOT_SET,
            title = "$issueKey wasn't reported in your name",
            message = "The issue was created as the shared Jira account because Jira didn't accept your Jira user as reporter: $error",
            link = testRunLink(testRun),
        ))
    }

    /**
     * A notification from another app of the suite, e.g. SparkStock reminding a tester of an overdue loan. Users who
     * turned these off, and disabled accounts, are skipped. `sourceRef` makes it idempotent per user: the app can
     * send the same reminder again and only one is kept. Returns null when there's no user with that ID.
     */
    @Transactional
    fun notifyExternal(request: ExternalNotificationDTO): ExternalNotificationResultDTO? {
        val userID = request.userID ?: throw IllegalArgumentException("Send the userID of the SparkyTC user to notify")
        val app = request.app?.trim()?.takeIf { it.isNotEmpty() } ?: throw IllegalArgumentException("Send the app's name")
        val title = request.title?.trim()?.takeIf { it.isNotEmpty() } ?: throw IllegalArgumentException("Send a title")
        val message = request.message?.trim().orEmpty()
        val link = request.link?.trim()?.takeIf { it.isNotEmpty() }
        val sourceRef = request.sourceRef?.trim()?.takeIf { it.isNotEmpty() }
        require(app.length <= 50) { "The app's name can have up to 50 characters" }
        require(title.length <= 200) { "The title can have up to 200 characters" }
        require(message.length <= 2000) { "The message can have up to 2000 characters" }
        require(sourceRef == null || sourceRef.length <= 200) { "The sourceRef can have up to 200 characters" }
        // the link opens the other app in a new tab, so it has to be a full web address
        require(link == null || (link.length <= 2000 && Regex("^https?://[^\\s]+$").matches(link))) { "The link must be an http or https address" }

        val user = userRepository.findByExternalID(userID) ?: return null
        if (!user.isActive) return ExternalNotificationResultDTO(created = false, skipped = "The user's account is disabled")
        if (!user.notifyExternal) return ExternalNotificationResultDTO(created = false, skipped = "The user turned off notifications from other apps")
        if (sourceRef != null) {
            notificationRepository.findByUserAndSourceRef(user, sourceRef)?.let {
                return ExternalNotificationResultDTO(created = false, notificationID = it.externalID)
            }
        }
        val notification = notificationRepository.saveAndFlush(Notification(
            user = user,
            type = NotificationType.EXTERNAL,
            title = title,
            message = message,
            link = link,
            appName = app,
            sourceRef = sourceRef,
        ))
        return ExternalNotificationResultDTO(created = true, notificationID = notification.externalID)
    }

    private fun testRunLink(testRun: TestRun) = "/test-runs/${testRun.project.projectShortCode}/${testRun.testRunNumber}"
}
