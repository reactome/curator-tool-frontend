import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormControl } from "@angular/forms";
import { Observable, map, startWith } from "rxjs";

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit{
  myControl = new FormControl('');
  options: string[] = ['One', 'Two', 'Three'];
  filteredOptions: Observable<string[]> | undefined;
  @Output() viewChangeEvent = new EventEmitter<string>();
  

  ngOnInit() {
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map((value: any) => this._filter(value || '')),
    );
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.options.filter(option => option.toLowerCase().includes(filterValue));
  }

  searchForName(event: Event) {
  }

  recordSearchKey(event: Event) {
  }

  switch_view(view: string) {
    this.viewChangeEvent.emit(view);
  }

}
