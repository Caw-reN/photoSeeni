<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFrameTemplateRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by middleware
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'sometimes|required|string|max:255',
            'image' => 'sometimes|required|image|mimes:png|max:2048', // Max 2MB PNG only, optional
            'slots' => 'sometimes|required|array|min:1',
            'slots.*.order' => 'required|integer|min:1',
            'slots.*.x_percent' => 'required|numeric|min:0|max:100',
            'slots.*.y_percent' => 'required|numeric|min:0|max:100',
            'slots.*.width_percent' => 'required|numeric|min:0|max:100',
            'slots.*.height_percent' => 'required|numeric|min:0|max:100',
            'slots.*.type' => 'nullable|string|in:photo,text',
            'slots.*.fontFamily' => 'nullable|string|max:100',
            'slots.*.color' => 'nullable|string|max:20',
            'slots.*.fontSize' => 'nullable|integer|min:8|max:200',
            'slots.*.maxChars' => 'nullable|integer|min:1|max:500',
        ];
    }

    /**
     * Get custom error messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Frame name is required.',
            'image.mimes' => 'Frame image must be a PNG file.',
            'image.max' => 'Frame image must not exceed 2MB.',
            'slots.required' => 'At least one photo slot is required.',
            'slots.array' => 'Slots must be a valid array.',
        ];
    }
}