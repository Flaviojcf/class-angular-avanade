import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Restaurant } from '../../interfaces/restaurant/restaurant';
import { ItemTotalPipe } from '../../pipes/item-total.pipe';
import { Order, OrderService } from '../../services/order/order.service';
import { RestaurantService } from '../../services/restaurant/restaurant.service';


export interface Item {
  name: string;
  price: number;
}

export interface OrderForm {
  restaurant: FormControl<string>;
  name: FormControl<string>;
  address: FormControl<string>;
  phone: FormControl<string>;
  items: FormControl<Item[]>;
}

// CUSTOM VALIDATION FUNCTION TO ENSURE THAT THE ITEMS FORM VALUE CONTAINS AT LEAST ONE ITEM.
function minLengthArray(min: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    if (c.value.length >= min) {
      return null;
    }
    return { minLengthArray: { valid: false } };
  };
}

@Component({
  selector: 'pmo-order',
  standalone: false,
  templateUrl: './order.component.html',
  styleUrl: './order.component.css',
})
export class OrderComponent implements OnInit, OnDestroy {
  formBuilder = inject(NonNullableFormBuilder);
  orderForm?: FormGroup<OrderForm>;
  restaurant?: Restaurant;
  isLoading = true;
  orderTotal = 0.0;
  completedOrder?: Order;
  orderComplete = false;
  orderProcessing = false;
  private onDestroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private restaurantService: RestaurantService,
    private orderService: OrderService,
    private itemTotal: ItemTotalPipe
  ) {}

  ngOnInit(): void {
    // GETTING THE RESTAURANT FROM THE ROUTE SLUG
    const slug = this.route.snapshot.paramMap.get('slug');

    if (slug) {
      this.restaurantService
        .getRestaurant(slug)
        .pipe(takeUntil(this.onDestroy$))
        .subscribe((data: Restaurant) => {
          this.restaurant = data;
          this.isLoading = false;
          this.createOrderForm();
        });
    }
  }

  ngOnDestroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  createOrderForm(): void {
    this.orderForm = this.formBuilder.group({
      restaurant: [this.restaurant?._id ?? '', Validators.required],
      name: ['', Validators.required],
      address: ['', Validators.required],
      phone: ['', Validators.required],
      // PASSING OUR CUSTOM VALIDATION FUNCTION TO THIS FORM CONTROL
      items: [[] as Item[], minLengthArray(1)],
    });
    this.onChanges();
  }

  getChange(newItems: Item[]): void {
    this.orderForm?.controls.items.patchValue(newItems);
  }

  onChanges(): void {
    // WHEN THE ITEMS CHANGE WE WANT TO CALCULATE A NEW TOTAL
    this.orderForm?.controls.items.valueChanges
      .pipe(takeUntil(this.onDestroy$))
      .subscribe((value) => {
        this.orderTotal = this.itemTotal.transform(value);
      });
  }

  onSubmit(): void {
    if (!this.orderForm?.valid) {
      return;
    }

    this.orderProcessing = true;
    this.orderService
      .createOrder(this.orderForm.getRawValue())
      .pipe(takeUntil(this.onDestroy$))
      .subscribe((res: Order) => {
        this.completedOrder = res;
        this.orderComplete = true;
        this.orderProcessing = false;
      });
  }

  startNewOrder(): void {
    this.orderComplete = false;
    this.completedOrder = undefined;
    this.orderTotal = 0.0;
    // CLEAR THE ORDER FORM
    this.createOrderForm();
  }
}