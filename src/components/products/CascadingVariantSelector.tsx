import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { ProductService } from '../../services/products/products.services';
import { StorageService } from '../../services/storage/storage.services';

export interface VariantOption {
  skuFamilyId: string;
  subSkuFamilyId?: string;
  subModelName: string;
  storage: string;
  color: string;
  ram?: string;
}

interface CascadingVariantSelectorProps {
  onVariantsSelected: (variants: VariantOption[]) => void;
}

interface SkuFamilyOption {
  _id: string;
  name: string;
  brand?: { _id: string; title: string };
  subModel?: string;
  storageId?: { _id: string; title: string };
  colorId?: { _id: string; title: string };
  ramId?: { _id: string; title: string };
  subSkuFamilies?: Array<{
    _id: string;
    subName?: string;
    storageId?: { _id: string; title: string; code?: string } | null;
    ramId?: { _id: string; title: string; code?: string } | null;
    colorId?: { _id: string; title: string; code?: string } | null;
    subSkuCode?: string;
  }>;
}

interface SelectOption {
  value: string;
  label: string;
  data?: any;
}

const CascadingVariantSelector: React.FC<CascadingVariantSelectorProps> = ({
  onVariantsSelected,
}) => {
  const [skuFamilies, setSkuFamilies] = useState<SkuFamilyOption[]>([]);
  const [selectedModels, setSelectedModels] = useState<SelectOption[]>([]);
  const [selectedStorages, setSelectedStorages] = useState<SelectOption[]>([]);
  const [selectedColors, setSelectedColors] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [allStorages, setAllStorages] = useState<Array<{ _id: string; title: string }>>([]);

  // Fetch all SKU families and storages on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [skuList, storageList] = await Promise.all([
          ProductService.listByName(''),
          StorageService.getStorageList(1, 1000).catch(() => ({ data: { docs: [] } }))
        ]);
        // Transform SKU list to match expected format
        const transformedSkuList = (skuList?.data || []).map((item: any) => ({
          _id: item._id || item.id,
          name: item.name || item.value || '',
        }));
        setSkuFamilies(transformedSkuList as any);
        // Filter and map storages to ensure _id exists
        const validStorages = (storageList?.data?.docs || [])
          .filter((s: any) => s && s._id && s.title)
          .map((s: any) => ({ _id: s._id, title: s.title }));
        setAllStorages(validStorages);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get unique models (SKU families) based on search
  const modelOptions = useMemo(() => {
    return skuFamilies.map(sku => ({
      value: sku._id,
      label: sku.name,
      data: sku,
    }));
  }, [skuFamilies]);

  // Get available storage options filtered by selected models
  const storageOptions = useMemo(() => {
    if (selectedModels.length === 0) return [];

    // If no storage found in selected models, show all available storages as fallback
    if (allStorages.length > 0) {
      return allStorages.map(storage => ({
        value: storage.title,
        label: storage.title,
      }));
    }

    return [];
  }, [selectedModels, allStorages]);

  // Get available color options - simplified for seller panel
  const colorOptions = useMemo(() => {
    // Return common colors as fallback
    return [
      { value: 'Graphite', label: 'Graphite' },
      { value: 'Silver', label: 'Silver' },
      { value: 'Gold', label: 'Gold' },
      { value: 'Sierra Blue', label: 'Sierra Blue' },
      { value: 'Mixed', label: 'Mixed' },
    ];
  }, []);

  // Generate variants when all selections are made
  useEffect(() => {
    if (selectedModels.length > 0 && selectedStorages.length > 0 && selectedColors.length > 0) {
      const variants: VariantOption[] = [];

      selectedModels.forEach(model => {
        selectedStorages.forEach(storage => {
          selectedColors.forEach(color => {
            const modelData = skuFamilies.find(sku => sku._id === model.value);
            if (modelData) {
              variants.push({
                skuFamilyId: model.value,
                subModelName: modelData.name,
                storage: storage.value,
                color: color.value,
              });
            }
          });
        });
      });

      onVariantsSelected(variants);
    } else {
      onVariantsSelected([]);
    }
  }, [selectedModels, selectedStorages, selectedColors, skuFamilies, onVariantsSelected]);

  const customSelectStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: '#f9fafb',
      borderColor: state.isFocused ? '#3b82f6' : '#e5e7eb',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      minHeight: '42px',
      borderRadius: '0.5rem',
      '&:hover': {
        borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
      },
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      zIndex: 9999,
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? '#3b82f6'
        : state.isFocused
        ? '#f3f4f6'
        : 'white',
      color: state.isSelected ? 'white' : '#111827',
      '&:hover': {
        backgroundColor: '#f3f4f6',
      },
    }),
    multiValue: (provided: any) => ({
      ...provided,
      backgroundColor: '#dbeafe',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: '#1e40af',
    }),
    multiValueRemove: (provided: any) => ({
      ...provided,
      color: '#1e40af',
      '&:hover': {
        backgroundColor: '#93c5fd',
        color: '#1e3a8a',
      },
    }),
  };

  return (
    <div className="space-y-6 p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <i className="fas fa-filter text-white text-lg"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              Multi-Variant Selection
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Select models → storage → colors. All combinations will be generated automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Model Selection */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            1
          </div>
          <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
            Select Models (Brand + Model) *
          </label>
        </div>
        <Select
          isMulti
          options={modelOptions}
          value={selectedModels}
          onChange={(newValue) => {
            setSelectedModels(newValue as SelectOption[]);
            setSelectedStorages([]);
            setSelectedColors([]);
          }}
          placeholder="🔍 Search and select models..."
          isSearchable
          isLoading={loading}
          styles={customSelectStyles}
          className="basic-select"
          classNamePrefix="select"
        />
      </div>

      {/* Step 2: Storage Selection */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            2
          </div>
          <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
            Select Storage Options *
          </label>
        </div>
        <Select
          isMulti
          options={storageOptions}
          value={selectedStorages}
          onChange={(newValue) => {
            setSelectedStorages(newValue as SelectOption[]);
            setSelectedColors([]);
          }}
          placeholder="🔍 Search and select storage options..."
          isSearchable
          isDisabled={selectedModels.length === 0}
          styles={customSelectStyles}
          className="basic-select"
          classNamePrefix="select"
        />
      </div>

      {/* Step 3: Color Selection */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            3
          </div>
          <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
            Select Colors *
          </label>
        </div>
        <Select
          isMulti
          options={colorOptions}
          value={selectedColors}
          onChange={(newValue) => setSelectedColors(newValue as SelectOption[])}
          placeholder="🔍 Search and select colors..."
          isSearchable
          isDisabled={selectedModels.length === 0 || selectedStorages.length === 0}
          styles={customSelectStyles}
          className="basic-select"
          classNamePrefix="select"
        />
      </div>

      {/* Preview */}
      {selectedModels.length > 0 &&
        selectedStorages.length > 0 &&
        selectedColors.length > 0 && (
          <div className="mt-6 p-5 bg-blue-600 dark:bg-blue-700 rounded-xl border-2 border-blue-400 dark:border-blue-600 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <i className="fas fa-calculator text-white text-xl"></i>
              </div>
              <div>
                <p className="text-lg font-bold text-white mb-1">
                  {selectedModels.length * selectedStorages.length * selectedColors.length} Variants Ready!
                </p>
                <p className="text-sm text-blue-100">
                  {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''} × {selectedStorages.length} storage ×{' '}
                  {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default CascadingVariantSelector;
