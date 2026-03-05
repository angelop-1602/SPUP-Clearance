"use client";

import React, { useState, useEffect } from 'react';
import { Student, ResearchType } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateSubmissionDetails } from '@/services/firebase';
import { isNotApplicableResearchType, normalizeResearchType } from '@/utils/researchType';
import { toast } from 'sonner';

interface EditSubmissionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submission: Student | null;
  onUpdate: (updatedSubmission?: Student) => void;
}

export function EditSubmissionDialog({
  isOpen,
  onOpenChange,
  submission,
  onUpdate
}: EditSubmissionDialogProps) {
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (submission) {
      setFormData({
        name: submission.name,
        email: submission.email,
        studentId: submission.studentId,
        adviser: submission.adviser || '',
        course: submission.course,
        graduationMonth: submission.graduationMonth || '',
        graduationYear: submission.graduationYear || '',
        researchTitle: submission.researchTitle || '',
        researchType: normalizeResearchType(submission.researchType),
        level: submission.level,
        groupMembers: submission.groupMembers || []
      });
    }
  }, [submission]);

  // Clear research-related fields when switching to Not Applicable (like student form).
  useEffect(() => {
    if (isNotApplicableResearchType(formData.researchType)) {
      setFormData(prev => ({
        ...prev,
        adviser: '',
        researchTitle: '',
        groupMembers: [{ name: "", studentID: "" }]
      }));
    }
  }, [formData.researchType]);

  const handleSave = async () => {
    if (!submission) return;

    setIsLoading(true);
    try {
      await updateSubmissionDetails(submission.id, formData);
      toast.success('Submission updated successfully');
      
      // Return updated submission data for optimistic local state update
      const updatedSubmission: Student = {
        ...submission,
        ...formData,
      } as Student;
      
      // Call onUpdate with updated submission for optimistic local state update
      onUpdate(updatedSubmission);
      
      // Close dialog first, then cleanup will happen in parent's onOpenChange
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating submission:', error);
      toast.error('Failed to update submission');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | ResearchType) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addGroupMember = () => {
    setFormData(prev => ({
      ...prev,
      groupMembers: [...(prev.groupMembers || []), { name: '', studentID: '' }]
    }));
  };

  const updateGroupMember = (index: number, field: 'name' | 'studentID', value: string) => {
    setFormData(prev => ({
      ...prev,
      groupMembers: prev.groupMembers?.map((member, i) => 
        i === index ? { ...member, [field]: value } : member
      ) || []
    }));
  };

  const removeGroupMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      groupMembers: prev.groupMembers?.filter((_, i) => i !== index) || []
    }));
  };

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Submission</DialogTitle>
          <DialogDescription>
            Make changes to the submission details below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Academic Information */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="level">Academic Level *</Label>
                <Select value={formData.level || ''} onValueChange={(value) => handleInputChange('level', value)}>
                  <SelectTrigger id="level">
                    <SelectValue placeholder="Choose level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="undergrad">Undergraduate</SelectItem>
                    <SelectItem value="grad">Graduate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="researchType">Research Type *</Label>
                <select
                  id="researchType"
                  required
                  aria-label="Research Type"
                  value={formData.researchType || ''}
                  onChange={(e) => handleInputChange('researchType', e.target.value as ResearchType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Capstone">Capstone</option>
                  <option value="Thesis">Thesis</option>
                  <option value="Dissertation">Dissertation</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {formData.level === 'undergrad' ? 'Leader Name *' : 'Full Name *'}
                </Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder={formData.level === 'undergrad' ? 'Enter leader name' : 'Enter full name'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="studentId">Student ID *</Label>
                <Input
                  id="studentId"
                  value={formData.studentId || ''}
                  onChange={(e) => handleInputChange('studentId', e.target.value)}
                  placeholder="Enter student ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course">Course *</Label>
                <Input
                  id="course"
                  value={formData.course || ''}
                  onChange={(e) => handleInputChange('course', e.target.value)}
                  placeholder="e.g., BSIT, BSCS, MIT, etc."
                />
              </div>
            </div>

            {/* Conditional fields for Thesis/Dissertation/Capstone */}
            {!isNotApplicableResearchType(formData.researchType) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="researchTitle">Research Title *</Label>
                    <Input
                      id="researchTitle"
                      value={formData.researchTitle || ''}
                      onChange={(e) => handleInputChange('researchTitle', e.target.value)}
                      placeholder="Enter research title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adviser">Research Adviser *</Label>
                    <Input
                      id="adviser"
                      value={formData.adviser || ''}
                      onChange={(e) => handleInputChange('adviser', e.target.value)}
                      placeholder="Enter adviser's name"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Graduation Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="graduationMonth">Graduation Month *</Label>
                <select
                  id="graduationMonth"
                  required
                  aria-label="Graduation Month"
                  value={formData.graduationMonth || ''}
                  onChange={(e) => handleInputChange('graduationMonth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="graduationYear">Graduation Year *</Label>
                <select
                  id="graduationYear"
                  required
                  aria-label="Graduation Year"
                  value={formData.graduationYear || ''}
                  onChange={(e) => handleInputChange('graduationYear', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Year</option>
                  {Array.from({ length: 16 }, (_, i) => {
                    const currentYear = new Date().getFullYear();
                    const year = currentYear - 10 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Group Members (Undergraduate only and not Not Applicable) */}
          {formData.level === 'undergrad' && !isNotApplicableResearchType(formData.researchType) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Group Members</h3>
                <Button type="button" variant="outline" size="sm" onClick={addGroupMember}>
                  + Add Member
                </Button>
              </div>
              {formData.groupMembers?.map((member, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-md space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Member {index + 1} Name</Label>
                      <Input
                        placeholder="Enter member name"
                        value={member.name}
                        onChange={(e) => updateGroupMember(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Student ID (optional)</Label>
                      <Input
                        placeholder="Enter student ID"
                        value={member.studentID}
                        onChange={(e) => updateGroupMember(index, 'studentID', e.target.value)}
                      />
                    </div>
                  </div>
                  {formData.groupMembers && formData.groupMembers.length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeGroupMember(index)}
                      >
                        Remove Member
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
