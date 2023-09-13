import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input, OnChanges, SimpleChanges } from '@angular/core'
import { NG_VALUE_ACCESSOR } from '@angular/forms'
import { MatTableDataSource, MatTableModule } from '@angular/material/table'

import { DynamicCellDirective } from './cells/directives/dynamic-cell.directive'
import { Column, ColumnType } from './columns/column'
import { DateColumn } from './columns/date-column'
import { TextColumn } from './columns/text-column'
import { MatCardModule } from '@angular/material/card'

@Component({
    selector: 'ppw-table',
    standalone: true,
    imports: [CommonModule, MatTableModule, MatCardModule, DynamicCellDirective],
    templateUrl: './table.component.html',
    styleUrls: ['./table.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => TableComponent),
            multi: true
        }
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableComponent<TRecord> implements OnChanges {
    @Input() public columns: Array<Column<TRecord, unknown>> = []
    @Input() public data: Array<Record<string, unknown>> = []

    /** The data source for the material table. */
    public dataSource!: MatTableDataSource<TableRecord>

    /** The names of the columns that are displayed. */
    public columnNames: Array<string> = []

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['columns']) {
            this.columnNames = this.columns.map((column) => column.name)
        }

        // We need to set the data source in either case because we remap the records
        // to a local set of records. So if a new column is added we need to remap
        // the records again.
        // When adding a new binding to this component, reconsider whether the following
        // line should still be executed for each change to the input bindings.
        this.setDataSource(this.data)
    }

    /**
     * Initialises an entirely new data source and sets the necessary properties.
     * @param items The items for the data source.
     */
    private setDataSource(items: Array<Record<string, unknown>>): void {
        this.dataSource?.disconnect()
        const localRecords = this._mapToLocalKeyValuePairs(items)
        this.dataSource = new MatTableDataSource(localRecords)
    }

    /** Checks whether the given record is of type TableRecord. */
    public isTableRecord(record: any): record is TableRecord {
        return 'mappedValues' in record
    }

    /**
     * Maps the given items into a local key-value pair to be used within
     * the template. The original record is left intact so that it can still
     * be passed along where necessary.
     * @param items The items to map.
     */
    private _mapToLocalKeyValuePairs(items: Array<Record<string, unknown>>): Array<TableRecord> {
        items ??= []
        return items.map((record) => {
            const mappedValues: Record<string, unknown> = {}
            for (const column of this.columns) {
                switch (column.type) {
                    case ColumnType.Date:
                        const dateColumn = column as DateColumn<unknown, any>
                        const mappedDateValue: unknown | undefined = getColumnValue(dateColumn, record)

                        mappedValues[dateColumn.name] = mappedDateValue
                            ? dateColumn.formatFn(mappedDateValue)
                            : undefined
                        break
                    case ColumnType.Text:
                    default:
                        mappedValues[column.name] = getColumnValue(column as TextColumn<any>, record)
                        break
                }
            }

            // Ensure that properties that have no corresponding column are still available in the mapped local record.
            return {
                initialRecord: record,
                mappedValues
            } as TableRecord
        })
    }
}

export interface TableRecord<T = any> {
    /** The initial record that was passed. */
    initialRecord: T
    /** A local mapped representation of the record. */
    mappedValues: Record<string, unknown>
}

/**
 * This function will search the record to see if there is a value nested within it.
 * @param record
 * @param selector
 */
export function getPossibleNestedValue(record: any, selector: any): any | undefined {
    selector = selector.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
    selector = selector.replace(/^\./, '') // strip a leading dot
    const a = selector.split('.')
    for (let i = 0, n = a.length; i < n; ++i) {
        const k = a[i]
        if (record != null && k in record) {
            record = record[k]
        } else {
            return
        }
    }
    return record
}

/**
 * This function wil get the value from the record to further map the values.
 * @param column
 * @param record
 */
export function getColumnValue<TRecord, TValue>(column: Column<TRecord, TValue>, record: TRecord): TValue | undefined {
    let mappedValue: TValue | undefined
    if (typeof column.value === 'undefined' || column.value === null) {
        mappedValue = getPossibleNestedValue(record, column.name)
    } else if (typeof column.value === 'string') {
        mappedValue = getPossibleNestedValue(record, column.value)
    } else {
        mappedValue = column.value(record)
    }

    return mappedValue
}
