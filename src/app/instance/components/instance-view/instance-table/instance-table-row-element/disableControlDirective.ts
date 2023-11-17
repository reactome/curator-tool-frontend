import {NG_ASYNC_VALIDATORS, NgControl} from '@angular/forms';
import {Directive, forwardRef, Input} from "@angular/core";
import {AttributeCategory, SchemaAttribute} from "../../../../../core/models/reactome-schema.model";

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
//
// @Directive({
//   selector: '[appUniqueAlterEgo]',
//   providers: [
//     {
//       provide: NG_ASYNC_VALIDATORS,
//       useExisting: forwardRef(() => UniqueAlterEgoValidatorDirective),
//       multi: true,
//     },
//   ],
//   standalone: true,
// })
// export class UniqueAlterEgoValidatorDirective implements AsyncValidator {
//   constructor(private validator: UniqueAlterEgoValidator) {}
//
//   validate(control: AbstractControl): Observable<ValidationErrors | null> {
//     return this.validator.validate(control);
//   }
// }
