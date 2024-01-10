import { DataService } from "src/app/core/services/data.service";
import {Injectable} from "@angular/core";
import {Actions} from "@ngrx/effects";

@Injectable()
export class BookmarkEffects {

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {}
}
