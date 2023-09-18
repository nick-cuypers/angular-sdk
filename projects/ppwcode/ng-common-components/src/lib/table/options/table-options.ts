/**
 * Interface describing the options to
 */
export interface PpwTableOptions<TRecord> {
    /**
     * The widths of the columns in the table.
     * The keys are the column names. Any string is allowed because column names are not limited to the keys of a record,
     *
     * The values are the widths in CSS units: px, %, em, rem, ...
     */
    columnWidths?: Record<keyof Partial<TRecord> | string, string>
}
