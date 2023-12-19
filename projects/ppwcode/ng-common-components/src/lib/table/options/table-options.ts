import { TemplateRef } from '@angular/core'

/**
 * Interface describing the options for a ppwcode table.
 */
export interface PpwTableOptions<TRecord> {
    /**
     * Configuration for the header of the table.
     */
    header?: {
        /** Whether the header should stick to the top of the table when scrolling. */
        sticky?: boolean
        /** Whether the header should be hidden. */
        hidden?: boolean
        /** Whether the first row should have a top border. This is only applied when the header is hidden. */
        showFirstRowTopBorder?: boolean
        /** CSS styles to conditionally apply to the header cells of the given columns. */
        styles?: Record<keyof Partial<TRecord> | string, () => { [key: string]: unknown }>
        /** Column templates to apply to the header cell of a column instead of the default. */
        templates?: Record<keyof Partial<TRecord> | string, () => TemplateRef<any>>
    }

    /**
     * Configuration for the columns of the table.
     */
    columns?: {
        /**
         * The widths of the columns in the table.
         * The keys are the column names. Any string is allowed because column names are not limited to the keys of a record,
         * because we can have columns that are calculated from other columns.
         * The values are the widths in CSS units: px, %, em, rem, ...
         */
        widths?: Record<keyof Partial<TRecord> | string, string>
        /** CSS styles to conditionally apply to the cells of the given columns. */
        styles?: Record<keyof Partial<TRecord> | string, (record: TRecord) => { [key: string]: unknown }>
        /** Column names to ignore the row click for. */
        ignoreClick?: string[]
    }

    /**
     * Configuration for the rows of the table.
     */
    rows: {
        /** Whether the row should be highlighted on hover. */
        highlightOnHover?: boolean
        /** Function to be executed when the row is clicked. */
        onClick?: (row: TRecord) => void
    }
}
