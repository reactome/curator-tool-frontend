import {Component, EventEmitter, Inject, Input, OnInit, Output} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {Store} from "@ngrx/store";
import {AttributeTableActions} from "../../../attribute-table/state/attribute-table.actions";

@Component({
  selector: 'app-row-element',
  templateUrl: './row-element.component.html',
  styleUrls: ['./row-element.component.scss']
})
export class RowElementComponent {
  @Input() elementType: string = 'STRING';
  @Input() elementValue: any = 'test';
  @Input() className: string = '';
  @Output() newEntryTableEvent = new EventEmitter<any>();
  @Output() getClassNameEvent = new EventEmitter<any>();


  constructor(public dialog: MatDialog, private store: Store) {
  }

  onClick(elementValue: any) {
    this.store.dispatch(AttributeTableActions.get({className:this.className}));
    this.newEntryTableEvent.emit(elementValue);
    console.log(this.className)
    this.getClassNameEvent.emit(this.className)
  }

  openDialog(elementValue: any): void {
    console.log(elementValue)
    const dialogRef = this.dialog.open(DialogOverviewExampleDialog, {
      data: {dbId: elementValue.dbId, className: this.className},
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      this.elementValue = result;
    });
  }
}


@Component({
  selector: 'dialog-popup',
  templateUrl: 'dialog-popup.component.html'
})

export class DialogOverviewExampleDialog {
  constructor(
    public dialogRef: MatDialogRef<DialogOverviewExampleDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { dbId: string, className: string },
  ) {
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
