import { Project } from '~/models/project'

/**
 * The projects in the order the user chose. The ones they never placed (new projects, or ones they were just
 * given) go after, in the order they came, which is title order.
 */
export function orderProjects(projects: Project[], order: string[] = []) {
	const position = new Map(order.map((shortCode, index) => [shortCode, index]))
	const unplaced = order.length
	// the sort is stable, so projects with the same position keep their title order
	return [...projects].sort(
		(a, b) =>
			(position.get(a.projectShortCode) ?? unplaced) -
			(position.get(b.projectShortCode) ?? unplaced)
	)
}

/** A copy of the list with the item at `from` moved to `to`. */
export function moveItem<T>(items: T[], from: number, to: number) {
	if (
		from === to ||
		from < 0 ||
		to < 0 ||
		from >= items.length ||
		to >= items.length
	) {
		return items
	}
	const moved = [...items]
	const [item] = moved.splice(from, 1)
	moved.splice(to, 0, item)
	return moved
}
