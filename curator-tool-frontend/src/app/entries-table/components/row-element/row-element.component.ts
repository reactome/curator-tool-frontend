import {Component, Inject, Input, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-row-element',
  templateUrl: './row-element.component.html',
  styleUrls: ['./row-element.component.scss']
})
export class RowElementComponent {
  @Input() elementType: string = 'STRING';
  @Input() elementValue: any = 'test';
  @Input() className: string = '';

  constructor(public dialog: MatDialog) {
  }

  onClick() {
    console.log("click")
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
