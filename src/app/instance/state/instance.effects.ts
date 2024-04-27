import { Injectable } from "@angular/core";
import { Actions } from "@ngrx/effects";
import { DataService } from "src/app/core/services/data.service";

// Keep it for the time being as a placeholder. May not use it in the future.
@Injectable()
export class DatabaseObjectEffects {

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {}
}
