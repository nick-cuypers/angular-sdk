import { animate, style, transition, trigger } from '@angular/animations'
import { SelectionModel } from '@angular/cdk/collections'
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop'
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    contentChild,
    contentChildren,
    ElementRef,
    forwardRef,
    inject,
    input,
    InputSignal,
    OnInit,
    output,
    OutputEmitterRef,
    Signal,
    TemplateRef,
    TrackByFunction,
    Type,
    viewChild
} from '@angular/core'
import { FormArray, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms'
import { MatTable, MatTableDataSource } from '@angular/material/table'
import { assert, notUndefined } from '@ppwcode/js-ts-oddsandends/lib/conditional-assert'
import { mixinHandleSubscriptions } from '@ppwcode/ng-common'
import { PpwColumnDirective } from './column-directives/ppw-column.directive'
import { Column, ColumnType } from './columns/column'
import { DateColumn } from './columns/date-column'
import { NumberColumn } from './columns/number-column'
import { TemplateColumn } from './columns/template-column'
import { TextColumn } from './columns/text-column'
import { PpwEmptyTablePageDirective } from './empty-page/ppw-empty-table-page.directive'
import { PpwTableOptions } from './options/table-options'
import { PPW_TABLE_DEFAULT_OPTIONS, PpwTableDefaultOptions } from './providers'

@Component({
    selector: 'ppw-table',
    templateUrl: './table.component.html',
    styleUrls: ['./table.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => TableComponent),
            multi: true
        }
    ],
    animations: [
        trigger('rowsAnimation', [
            transition(':enter', [
                style({ transform: 'translateY(-10%)', opacity: 0 }),
                animate('.25s ease-in-out', style({ transform: 'translateY(0)', opacity: 1 }))
            ])
        ])
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableComponent<TRecord> extends mixinHandleSubscriptions() implements OnInit {
    #elementRef: ElementRef = inject(ElementRef)
    #tableDefaultOptions: PpwTableDefaultOptions | null = inject(PPW_TABLE_DEFAULT_OPTIONS, { optional: true })

    public headerTemplates: Record<string | keyof TRecord, TemplateRef<unknown>> = {} as Record<
        string | keyof TRecord,
        TemplateRef<unknown>
    >

    public footerValues: Record<string | keyof TRecord, string> = {} as Record<string | keyof TRecord, string>

    // Inputs
    public data: InputSignal<Array<Record<string, unknown>> | FormArray<FormGroup>> = input.required()
    public footerData: InputSignal<Record<string, unknown> | undefined> = input()
    // public footerColumnNames: InputSignal<Array<string> | undefined> = input()
    public trackBy: InputSignal<TrackByFunction<TRecord>> = input.required()
    public enableRowSelection: InputSignal<boolean> = input(false)
    public enableRowDrag: InputSignal<boolean> = input(false)
    public options: InputSignal<PpwTableOptions<TRecord> | undefined> = input<PpwTableOptions<TRecord> | undefined>(
        undefined
    )

    // Outputs
    public selectionChanged: OutputEmitterRef<TableRecord<TRecord>[]> = output<TableRecord<TRecord>[]>()
    public orderChanged: OutputEmitterRef<TableRecord<TRecord>[]> = output<TableRecord<TRecord>[]>()

    // Content children
    public emptyPageTemplate: Signal<TemplateRef<unknown> | undefined> = contentChild(PpwEmptyTablePageDirective, {
        read: TemplateRef
    })
    public columnDirectives: Signal<readonly PpwColumnDirective<TRecord>[]> = contentChildren(PpwColumnDirective)

    // View children
    table: Signal<MatTable<TRecord>> = viewChild.required(MatTable)

    public get emptyPageComponent(): Type<unknown> | undefined {
        return this.#tableDefaultOptions?.emptyPageComponent
    }

    /** Gets whether a custom height has been set by the --ppw-table-height CSS variable. */
    public get hasFixedHeight(): boolean {
        const cssHeightValue = getComputedStyle(this.#elementRef.nativeElement).getPropertyValue('--ppw-table-height')
        return cssHeightValue !== 'auto' && cssHeightValue !== ''
    }

    public columns: Signal<Array<Column<TRecord, unknown>>> = computed(() => {
        const columnDirectives = this.columnDirectives()

        columnDirectives.forEach((columnDirective) => {
            if (columnDirective.headerTemplate) {
                this.headerTemplates[columnDirective.name()] = columnDirective.headerTemplate
            }
        })

        // Generate the columns from the found ppw-column instances in the content children.
        return columnDirectives.map((columnDirective) => {
            assert(
                columnDirective.columnDefinition(),
                () => !!columnDirective.columnDefinition(),
                `A column definition could not be found, make sure your ppw-column templates are defined correctly.`
            )
            return notUndefined(columnDirective.columnDefinition())
        })
    })

    /** The names of the columns that are displayed. */
    public columnNames: Signal<Array<string>> = computed(() => {
        const names = this.columns().map((column) => column.name)

        // The following columns available by the table component itself. Their visibility is handled by the input bindings.
        if (this.enableRowSelection()) {
            names.unshift('rowSelection')
        }
        if (this.enableRowDrag()) {
            names.unshift('rowDrag')
        }

        return names
    })

    /** The data source for the material table. */
    public dataSource: Signal<MatTableDataSource<TableRecord<TRecord>>> = computed(() => {
        const localRecords = this._mapToLocalKeyValuePairs(this.data(), this.columns())
        return new MatTableDataSource(localRecords)
    })

    dragDisabled = true
    public selection = new SelectionModel<TableRecord<TRecord>>(
        true,
        [],
        true,
        (o1: TableRecord<TRecord>, o2: TableRecord<TRecord>) => {
            return o1.trackByValue === o2.trackByValue
        }
    )

    /** Whether the number of selected elements matches the total number of rows. */
    isAllSelected() {
        const numRows = this.dataSource().data.length
        if (numRows === 0) {
            return false
        }

        const selectedRecords = this.dataSource().data.filter((record: TableRecord<TRecord>) => {
            return this.selection.isSelected(record)
        })
        return (selectedRecords?.length ?? 0) === numRows
    }

    /** Whether the number of selected elements is greater than 0 but not equals to the total number of rows. */
    isSomeSelected() {
        const numRows = this.dataSource().data.length
        const selectedRecords = this.dataSource().data.filter((record: TableRecord<TRecord>) => {
            return this.selection.isSelected(record)
        })
        return (selectedRecords?.length ?? 0) > 0 && (selectedRecords?.length ?? 0) < numRows
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected()
            ? this.selection.clear()
            : this.dataSource().data.forEach((row: TableRecord<TRecord>) => this.selection.select(row))
    }

    public ngOnInit(): void {
        this.stopOnDestroy(this.selection.changed).subscribe(() => {
            this.selectionChanged.emit(this.selection.selected)
        })
    }

    public trackByFn(_index: number, item: TableRecord<TRecord>): unknown {
        return item.trackByValue
    }

    /**
     * Maps the given items into a local key-value pair to be used within
     * the template. The original record is left intact so that it can still
     * be passed along where necessary.
     * @param items The items to map.
     */
    private _mapToLocalKeyValuePairs(
        items: Array<Record<string, unknown>> | FormArray<FormGroup>,
        columns: Array<Column<TRecord, unknown>>
    ): Array<TableRecord<TRecord>> {
        let records: Array<unknown>

        if (items instanceof FormArray) {
            records = items.controls
        } else {
            records = items ?? []
        }

        return records.map((record, index) => {
            const mappedValues: Record<string, unknown> = {}
            for (const column of columns) {
                mappedValues[column.name] = this.mapValue(column, record)
            }

            // Ensure that properties that have no corresponding column are still available in the mapped local record.
            return {
                initialRecord: record,
                mappedValues,
                trackByValue: this.trackBy()(index, record as TRecord)
            } as TableRecord<TRecord>
        })
    }

    public mapValue(column: Column<TRecord, unknown>, record: unknown) {
        switch (column.type) {
            case ColumnType.Date: {
                const dateColumn = column as DateColumn<unknown, unknown>
                const mappedDateValue: unknown | undefined = getColumnValue(dateColumn, record)

                return mappedDateValue ? dateColumn.formatFn(mappedDateValue) : undefined
            }
            case ColumnType.Number: {
                const numberColumn = column as NumberColumn<unknown>
                const mappedNumberValue: unknown | undefined = getColumnValue(numberColumn, record)

                return numberColumn.formatFn && mappedNumberValue !== null && mappedNumberValue !== undefined
                    ? numberColumn.formatFn(mappedNumberValue as number)
                    : mappedNumberValue !== null && mappedNumberValue !== undefined
                      ? mappedNumberValue
                      : undefined
            }
            case ColumnType.Template: {
                const templateColumn = column as TemplateColumn<unknown>
                return getColumnValue(templateColumn, record)
            }
            case ColumnType.Text:
            default:
                return getColumnValue(column as TextColumn<unknown>, record)
        }
    }

    public executeRowClick(record: TRecord, columnName: string): void {
        const onClick = this.options()?.rows?.onClick
        onClick && (this.options()?.columns?.ignoreClick?.indexOf(columnName) ?? -1 < 0) ? onClick(record) : null
    }

    public dropTable(event: CdkDragDrop<MatTableDataSource<TableRecord<TRecord>>, any>): void {
        moveItemInArray(this.dataSource().data, event.previousIndex, event.currentIndex)
        this.table().renderRows()
        this.orderChanged.emit(this.dataSource().data)
    }

    protected readonly notUndefined = notUndefined
}

export interface TableRecord<T = unknown> {
    /** The initial record that was passed. */
    initialRecord: T
    /** A local mapped representation of the record. */
    mappedValues: Record<string, unknown>
    /** The value generated for the trackBy function. */
    trackByValue: unknown
}

/**
 * This function will search the record to see if there is a value nested within it.
 * @param record
 * @param selector
 */
export function getPossibleNestedValue<TValue>(record: never, selector: string): TValue | undefined {
    selector = selector.replace(/\[(\w+)]/g, '.$1') // convert indexes to properties
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
        mappedValue = getPossibleNestedValue<TValue | undefined>(record as never, column.name)
    } else if (typeof column.value === 'string') {
        mappedValue = getPossibleNestedValue<TValue | undefined>(record as never, column.value)
    } else {
        mappedValue = column.value(record)
    }

    return mappedValue
}
