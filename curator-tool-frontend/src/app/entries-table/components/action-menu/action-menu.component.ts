import {Component, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {FormControl} from "@angular/forms";
import {EMPTY, map, Observable, startWith} from "rxjs";
import {MatMenuTrigger} from "@angular/material/menu";

export interface User {
  name: string;
}
@Component({
  selector: 'app-action-menu',
  templateUrl: './action-menu.component.html',
  styleUrls: ['./action-menu.component.scss'],
})
export class ActionMenuComponent implements OnInit{
  @Input() row: string = '';
  myControl = new FormControl<string | User>('');
  options: User[] = [{name: 'Mary'}, {name: 'Shelley'}, {name: 'Igor'}];
  filteredOptions: Observable<User[]> = EMPTY;
  showPanel: boolean = false;

  ngOnInit() {
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const name = typeof value === 'string' ? value : value?.name;
        return name ? this._filter(name as string) : this.options.slice();
      }),
    );
  }

  showLookupPanel(){
    this.showPanel = !this.showPanel;
  }
  displayFn(user: User): string {
    return user && user.name ? user.name : '';
  }

  private _filter(name: string): User[] {
    const filterValue = name.toLowerCase();

    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }

}
