import {NG_ASYNC_VALIDATORS, NgControl} from '@angular/forms';
import {Directive, forwardRef, Input} from "@angular/core";
import {AttributeCategory, SchemaAttribute} from "../../../../../../core/models/reactome-schema.model";

@Directive({
  selector: '[disableControl]',
    providers: [
    {
      provide: NG_ASYNC_VALIDATORS,
      useExisting: forwardRef(() => DisableControlDirective),
      multi: true,
    },
  ],
})
export class DisableControlDirective {
  @Input() set disableControl( attribute: SchemaAttribute  ) {
    let action:boolean = attribute?.category === AttributeCategory.NOMANUALEDIT ;
    // this.ngControl.control[action]();
  }

  constructor( private ngControl : NgControl ) {
  }

}

