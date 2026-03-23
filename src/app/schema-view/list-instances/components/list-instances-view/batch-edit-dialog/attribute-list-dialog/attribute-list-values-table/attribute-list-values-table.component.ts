import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-attribute-list-values-table',
    templateUrl: './attribute-list-values-table.component.html',
    styleUrls: ['./attribute-list-values-table.component.scss']
})
export class AttributeListValuesTableComponent {
    @Input() values: any[] = [];
    @Input() selectedValues: any[] = [];
    @Output() selectValue = new EventEmitter<any>();
    @Output() deselectValue = new EventEmitter<any>();

    displayedColumns: string[] = ['displayName', 'actionButtons'];

    addCheckBox(element: any) {
        this.selectValue.emit(element);
    }

    isChecked(att: any): boolean {
        if (!this.selectedValues) return false;
        return this.selectedValues.some(i => i === att);
    }

    removeCheckBox( att: any) {
        this.deselectValue.emit(att);
    }
}
