import { ReactNode } from 'react'
import { Checkbox } from './Checkbox'

export interface TableRow<T> {
	id: string
	data: T
	isSelected?: boolean
}

export type Column<T> = {
	header?: string
	key: string
	render: (item: T) => ReactNode
	// how the column shows in the card each row becomes on phones and tablets; a labeled value by default
	mobile?: 'title' | 'subtitle' | 'hidden'
}

type TableProps<T> = {
	tableRows: TableRow<T>[]
	columns: Column<T>[]
	onRowClick?: (item: T) => void
	allowSelectAll?: boolean
}

export function Table<T>({
	tableRows,
	columns,
	onRowClick,
	allowSelectAll,
}: TableProps<T>) {
	// compute if all rows are selected
	const allSelected =
		tableRows.length > 0 && tableRows.every((r) => r.isSelected)
	// toggle selection on every row
	const handleSelectAll = () => {
		tableRows.forEach((r) => {
			if (onRowClick && r.isSelected !== !allSelected) {
				onRowClick(r.data)
			}
		})
	}

	return (
		<div>
			<MobileCards
				tableRows={tableRows}
				columns={columns}
				onRowClick={onRowClick}
				allowSelectAll={allowSelectAll}
				allSelected={allSelected}
				onSelectAll={handleSelectAll}
			/>
			<div className="hidden overflow-x-auto lg:block">
				<table className="min-w-full divide-y divide-gray-200">
					<thead>
						<tr>
							{columns.map((column, colIndex) => (
								<th
									key={column.key}
									className={`py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
										column.header ? '' : 'w-2'
									} ${colIndex === 0 && allowSelectAll ? 'px-2' : 'px-6'}`}
								>
									{colIndex === 0 && allowSelectAll ? (
										<button onClick={handleSelectAll}>
											<Checkbox isSelected={allSelected} />
										</button>
									) : (
										column.header
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="bg-white divide-y divide-gray-200">
						{tableRows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="px-6 py-4 text-sm text-gray-500 text-center"
								>
									No items to display yet
								</td>
							</tr>
						) : (
							tableRows.map((item, index) => (
								<tr
									key={index}
									onClick={() => onRowClick?.(item.data)}
									className={`hover:bg-gray-100 cursor-pointer rounded-lg ${
										item.isSelected === true ? 'bg-gray-100' : ''
									}`}
								>
									{columns.map((column, colIndex) => (
										<td
											key={`${column.key}-${index}`}
											className={`py-3 whitespace-nowrap text-sm font-medium text-gray-900 ${
												columns[colIndex].header ? 'px-6' : 'px-2'
											} ${colIndex === 0 ? 'rounded-l-xl' : ''} ${
												colIndex === columns.length - 1 ? 'rounded-r-xl' : ''
											}`}
										>
											{column.render(item.data)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}

/** The rows as cards on phones, where the table's columns don't fit. */
function MobileCards<T>({
	tableRows,
	columns,
	onRowClick,
	allowSelectAll,
	allSelected,
	onSelectAll,
}: TableProps<T> & { allSelected: boolean; onSelectAll: () => void }) {
	// columns without a header, like the selection checkbox, sit on the left of the card
	const leading = columns.filter((column) => !column.header)
	const subtitle = columns.filter(
		(column) => column.header && column.mobile === 'subtitle'
	)
	const title = columns.filter(
		(column) => column.header && column.mobile === 'title'
	)
	const details = columns.filter((column) => column.header && !column.mobile)

	return (
		<div className="space-y-2 lg:hidden">
			{allowSelectAll && tableRows.length > 0 && (
				<button
					type="button"
					onClick={onSelectAll}
					className="flex items-center gap-2 px-1 py-1 text-sm font-medium text-gray-700"
				>
					<Checkbox isSelected={allSelected} />
					Select all
				</button>
			)}
			{tableRows.length === 0 && (
				<p className="py-4 text-center text-sm text-gray-500">
					No items to display yet
				</p>
			)}
			{tableRows.map((row) => (
				// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
				<div
					key={row.id}
					onClick={() => onRowClick?.(row.data)}
					className={`flex gap-3 rounded-lg border border-gray-200 p-3 ${
						onRowClick ? 'cursor-pointer active:bg-gray-100' : ''
					} ${row.isSelected ? 'bg-gray-100' : 'bg-white'}`}
				>
					{leading.map((column) => (
						<div key={column.key} className="pt-0.5">
							{column.render(row.data)}
						</div>
					))}
					<div className="min-w-0 flex-1">
						{subtitle.map((column) => (
							<div
								key={column.key}
								className="text-xs font-medium text-gray-500"
							>
								{column.render(row.data)}
							</div>
						))}
						{title.map((column) => (
							<div
								key={column.key}
								className="break-words text-sm font-medium text-gray-900"
							>
								{column.render(row.data)}
							</div>
						))}
						{details.length > 0 && (
							<dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
								{details.map((column) => (
									<div key={column.key} className="contents">
										<dt className="text-xs text-gray-500">{column.header}</dt>
										<dd className="min-w-0 text-gray-900">
											{column.render(row.data)}
										</dd>
									</div>
								))}
							</dl>
						)}
					</div>
				</div>
			))}
		</div>
	)
}
