import { useFetcher } from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { ErrorResponse, TestCaseAttachment } from '~/models/types'
import { Route } from '~/utility/Routes'
import { ErrorMessage } from './ErrorMessage'

const ACCEPTED_FILE_TYPES = 'image/*,video/*'

interface AttachmentGalleryProps {
	attachments: TestCaseAttachment[]
	// where new files are uploaded, the test case's attachments unless set
	testCaseID?: string
	uploadAction?: string
	// adding files; deleting them too unless canDelete says otherwise
	editable?: boolean
	canDelete?: boolean
	// smaller previews, e.g. for the evidence of a result
	compact?: boolean
	emptyMessage?: string
	uploadLabel?: string
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(attachment: TestCaseAttachment) {
	return attachment.contentType.startsWith('image/')
}

function isVideo(attachment: TestCaseAttachment) {
	return attachment.contentType.startsWith('video/')
}

export function AttachmentGallery({
	testCaseID,
	attachments,
	uploadAction,
	editable = false,
	canDelete = editable,
	compact = false,
	emptyMessage = 'No images or videos attached',
	uploadLabel = 'Add images or videos',
}: AttachmentGalleryProps) {
	const uploadFetcher = useFetcher<ErrorResponse | { ok: true }>()
	const deleteFetcher = useFetcher<ErrorResponse | { ok: true }>()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [previewAttachment, setPreviewAttachment] =
		useState<TestCaseAttachment>()

	const isUploading = uploadFetcher.state !== 'idle'
	const error =
		(uploadFetcher.data && 'message' in uploadFetcher.data
			? uploadFetcher.data.message
			: undefined) ||
		(deleteFetcher.data && 'message' in deleteFetcher.data
			? deleteFetcher.data.message
			: undefined)

	useEffect(() => {
		if (uploadFetcher.state === 'idle' && fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}, [uploadFetcher.state])

	useEffect(() => {
		if (!previewAttachment) return
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setPreviewAttachment(undefined)
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [previewAttachment])

	const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files
		if (!files || files.length === 0) return

		const formData = new FormData()
		for (const file of Array.from(files)) {
			formData.append('files', file)
		}
		uploadFetcher.submit(formData, {
			method: 'post',
			action: uploadAction ?? Route.testCaseAttachments(testCaseID ?? ''),
			encType: 'multipart/form-data',
		})
	}

	const handleDelete = (attachment: TestCaseAttachment) => {
		if (!confirm(`Are you sure you want to delete ${attachment.fileName}?`)) {
			return
		}
		deleteFetcher.submit(null, {
			method: 'delete',
			action: Route.attachment(attachment.attachmentID),
		})
	}

	const deletingAttachmentID =
		deleteFetcher.state !== 'idle'
			? deleteFetcher.formAction?.split('/').pop()
			: undefined
	const visibleAttachments = attachments.filter(
		(attachment) => attachment.attachmentID !== deletingAttachmentID
	)

	return (
		<div className="space-y-3">
			{error && <ErrorMessage message={error} />}

			{visibleAttachments.length === 0 ? (
				<p className="text-sm text-gray-500">{emptyMessage}</p>
			) : (
				<div
					className={
						compact
							? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
							: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
					}
				>
					{visibleAttachments.map((attachment) => {
						const src = Route.attachment(attachment.attachmentID)
						return (
							<figure
								key={attachment.attachmentID}
								className="overflow-hidden rounded-md border border-gray-200 bg-white"
							>
								<div
									className={`flex items-center justify-center bg-gray-50 ${
										compact ? 'h-28' : 'h-48'
									}`}
								>
									{isImage(attachment) ? (
										<button
											type="button"
											onClick={() => setPreviewAttachment(attachment)}
											className="h-full w-full"
											title="Click to enlarge"
										>
											<img
												src={src}
												alt={attachment.fileName}
												loading="lazy"
												className="h-full w-full object-contain"
											/>
										</button>
									) : isVideo(attachment) ? (
										<video
											src={src}
											controls
											preload="metadata"
											className="h-full w-full bg-black object-contain"
										>
											<track kind="captions" />
										</video>
									) : (
										<span className="text-sm text-gray-500">
											Preview not available
										</span>
									)}
								</div>
								<figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600">
									<a
										href={src}
										target="_blank"
										rel="noopener noreferrer"
										className="truncate hover:text-brand-700 hover:underline"
										title={
											attachment.uploadedBy
												? `${attachment.fileName}, uploaded by ${attachment.uploadedBy}`
												: attachment.fileName
										}
									>
										{attachment.fileName}
									</a>
									<span className="flex shrink-0 items-center gap-2">
										{!compact && (
											<span>{formatFileSize(attachment.fileSize)}</span>
										)}
										{canDelete && (
											<button
												type="button"
												onClick={() => handleDelete(attachment)}
												className="text-red-600 hover:text-red-800"
											>
												Delete
											</button>
										)}
									</span>
								</figcaption>
							</figure>
						)
					})}
				</div>
			)}

			{editable && (
				<div>
					<label
						className={`inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
							isUploading ? 'pointer-events-none opacity-50' : ''
						}`}
					>
						{isUploading ? 'Uploading...' : uploadLabel}
						<input
							ref={fileInputRef}
							type="file"
							accept={ACCEPTED_FILE_TYPES}
							multiple
							className="sr-only"
							onChange={handleFilesSelected}
							disabled={isUploading}
						/>
					</label>
				</div>
			)}

			{previewAttachment && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
					onClick={() => setPreviewAttachment(undefined)}
					role="presentation"
				>
					<img
						src={Route.attachment(previewAttachment.attachmentID)}
						alt={previewAttachment.fileName}
						className="max-h-full max-w-full object-contain"
					/>
					<button
						type="button"
						onClick={() => setPreviewAttachment(undefined)}
						className="absolute right-4 top-4 rounded-md bg-white/90 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-white"
					>
						Close
					</button>
				</div>
			)}
		</div>
	)
}
