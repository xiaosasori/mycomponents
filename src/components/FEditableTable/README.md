# FEditableTable

A light-weight spreadsheet component.

## Features

+ Context menu.
+ Drag-and-drop.
+ Synchronized editing.
+ Can re-use any third-party input component.

## Usage

### Simple usage with nice defaults

```vue
<template>
    <f-editable-cell :columns="columns" :rows="rows" @input="onInput($event)" />
</template>

<script>
export default {
    data () {
        return {
            // List of columns of the table
            columns: [
                // `name` is required. It must match with a row attribute.
                {name: 'name', displayName: 'Name'},

                // `displayName` is optional, will be rendered in the table header instead of `name` if available.
                {name: 'address', displayName: 'Address'},

                // {type: number|text|textarea} will render input with corresponding type. Default to text.
                {name: 'age', displayName: 'Age', type: 'number'}
            ],
            // List of rows
            rows: [
                // Each editable row attribute should match a column by column's name.
                {name: 'John Doe', address: 'Lorem Street, Ipsum County', age: 30},
                {name: 'Jane Doe', address: 'Lorem Street, Ipsum County', age: 24},
            ]
        }
    },
    methods: {
        /**
         * Table's `input` event handler. The $event provides `row` and `column` to locate upon
         * which cell the input event was fired and `value` that contains the new input value.
         * @param row
         * @param column
         * @param value
         */
        onInput ({row, column, value}) {
            // Assign the value into row.
            // Using vuex will require a `commit` call but the logic should be similar.
            row[column.name] = value
        }
    }
}
</script>
```

## Performance

This component can provide fast rendering due to the fact that it only renders
a simple table with text cells and only one input element at all time.

To avoid input latency or cursor navigation latency:

+ Do not use any property that changes frequently (on input or navigating the cursor)
to render cells. Best practice: Only use provided slot scope data to render the cell.

  **Bad example:** Use the `cursor` model to give current cell a separate style.
  This causes Vue to unnecessarily re-compute the style of **all cells**
  whenever cursor moves to another cell. Cursor navigation will be laggy as a result.
