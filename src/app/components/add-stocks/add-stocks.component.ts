import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { ActionType, ComponentType } from 'src/app/models/audit/audit_type';
import { Products } from 'src/app/models/products';
import { UserType } from 'src/app/models/user-type';
import { Users } from 'src/app/models/users';
import { Variation } from 'src/app/models/variation';
import { AuditLogService } from 'src/app/services/audit-log.service';
import { AuthService } from 'src/app/services/auth.service';
import { ProductService } from 'src/app/services/product.service';
import { BatchNumberService } from 'src/app/services/batch-number.service';
import { take } from 'rxjs';
import { LoadingService } from 'src/app/services/loading.service';

@Component({
  selector: 'app-add-stocks',
  templateUrl: './add-stocks.component.html',
  styleUrls: ['./add-stocks.component.css'],
})
export class AddStocksComponent implements OnInit {
  activeModal = inject(NgbActiveModal);
  @Input() product!: Products;

  users$: Users | null = null;
  expirationDate: Date | null = null;
  variations$: { id: string; name: string; stocks: number }[] = [];
  newStocks = 0;
  newStocksValue = 0;

  constructor(
    public loadingService: LoadingService,
    private productService: ProductService,
    private toastr: ToastrService,
    private auditLogService: AuditLogService,
    private authService: AuthService,
    private batchNumberService: BatchNumberService,
  ) {
    authService.users$.subscribe(data => { this.users$ = data; });
  }

  ngOnInit(): void {
    this.product.variations.forEach(e => {
      this.variations$.push({ id: e.id, name: e.name, stocks: 0 });
    });
  }

  handleExpirationDateInput(event: Event) {
    const inputValue = (event.target as HTMLInputElement).value;
    const newExpirationDate = inputValue ? new Date(inputValue) : null;
  
    // Check if the inputted expiration date is earlier than the current expiration date
    if (newExpirationDate && this.product.expiryDate && newExpirationDate < this.product.expiryDate) {
      return; // Do not update if the date is invalid
    }
  
    // Update the product's expiration date (main product expiration date)
    this.product.expiryDate = newExpirationDate; // This will ensure the product gets updated, not the variations
    this.expirationDate = newExpirationDate; // Keep the local expirationDate in sync with the form input
  } 

  updateVariationStock(index: number, event: Event) {
    const newValue = parseInt((event.target as HTMLInputElement).value);

    // Ensure that newValue is a valid number and avoid stock doubling
    if (!isNaN(newValue) && newValue > 0) {
      this.variations$[index].stocks = newValue; // Set it directly instead of adding
    }
  }

  updateProductStocks(event: Event) {
    this.newStocksValue = parseInt((event.target as HTMLInputElement).value);
    this.newStocks = this.product.stocks + parseInt((event.target as HTMLInputElement).value);
  }

  saveStocks() {
    // Show loading indicator
    this.loadingService.showLoading('save-stocks');
  
    this.productService.getProductByID(this.product.id).pipe(take(1)).subscribe(productData => {
      if (!productData) {
        this.toastr.error('Product not found!');
        this.loadingService.hideLoading('save-stocks'); // Hide loading on error
        return;
      }
  
      if (this.product.variations.length > 0) {
        // Handle variations
        this.product.variations.forEach(variation => {
          const variationUpdate = this.variations$.find(v => v.id === variation.id);
          if (variationUpdate && variationUpdate.stocks > 0) {
            variation.stocks += variationUpdate.stocks;
  
            const lastVarBatch = variation.batchNumber?.[variation.batchNumber.length - 1];
            const lastVarSequence = lastVarBatch ? parseInt(lastVarBatch.batchNumber.split('-').pop()!) : 0;
  
            const variationBatchData = this.batchNumberService.generateBatchNumber(
              variation.id,
              new Date(),
              lastVarSequence,
              variationUpdate.stocks,
              this.expirationDate
            );
  
            this.batchNumberService.addNewBatchNumber(this.product, variation.id, variationBatchData, this.expirationDate);
            this.logAudit(variationBatchData);
          }
        });
      } else {
        // Handle product without variations
        this.product.stocks += this.newStocksValue;
  
        const lastBatch = productData.batchNumber?.[productData.batchNumber.length - 1];
        const lastSequence = lastBatch ? parseInt(lastBatch.batchNumber.split('-').pop()!) : 0;
  
        const batchData = this.batchNumberService.generateBatchNumber(
          this.product.id,
          new Date(),
          lastSequence,
          this.newStocksValue,
          this.expirationDate
        );
  
        this.batchNumberService.addNewBatchNumber(this.product, null, batchData, this.expirationDate);
        this.logAudit(batchData);
      }
  
      // Update the product in the database
      this.productService.updateProduct(this.product)
        .then(() => {
          this.activeModal.close();
        })
        .catch(error => {
          this.toastr.error('Failed to update stocks.');
          console.error('Error saving product:', error);
        })
        .finally(() => {
          this.loadingService.hideLoading('save-stocks'); // Always hide loading after operation
        });
    });
  }
  
  
  private async logAudit(batchData: any) {
    await this.auditLogService.createAudit({
      id: '',
      email: this.users$?.email || '',
      role: this.users$?.type || UserType.ADMIN,
      action: ActionType.UPDATE,
      component: ComponentType.INVENTORY,
      payload: {
        message: `Added new stocks with batch number: ${batchData.batchNumber}`,
        productID: this.product.id,
        user: this.users$?.name,
        userId: this.users$?.id,
      },
      details: 'Adding new stocks to inventory',
      timestamp: new Date(),
    });

    this.toastr.success('Successfully added new stocks!');
    this.activeModal.close();
  }

  hasStockToAdd(): boolean {
    // Check if the main product or any variation has stocks greater than 0
    if (this.product.stocks + this.newStocks > this.product.stocks) {
      return true;
    }
    for (const variation of this.variations$) {
      if (variation.stocks > 0) {
        return true;
      }
    }
    return false;
  }
}
