import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { defaultLifecycleTasks } from './hr-lifecycle-defaults';

@Injectable()
export class RecruitmentService {
  async listOpenings(req:any) {
    const data=await prisma.jobOpening.findMany({where:{...tenantWhere(req.user?.tenantId)},include:{_count:{select:{candidates:true}}},orderBy:{createdAt:'desc'}});
    return {data,count:data.length};
  }
  async createOpening(req:any,dto:any) {
    const tenantId=req.user?.tenantId;
    if(dto.departmentId){const d=await prisma.department.findFirst({where:{...tenantWhere(tenantId),id:dto.departmentId}});if(!d)throw new NotFoundException('Department not found');}
    if(await prisma.jobOpening.findFirst({where:{...tenantWhere(tenantId),code:dto.code}}))throw new ConflictException('Job opening code already exists');
    return prisma.jobOpening.create({data:{tenantId,code:dto.code,title:dto.title,departmentId:dto.departmentId||null,description:dto.description||null,location:dto.location||null,employmentType:dto.employmentType||null,openings:dto.openings||1}});
  }
  async closeOpening(req:any,id:string){const o=await prisma.jobOpening.findFirst({where:{...tenantWhere(req.user?.tenantId),id}});if(!o)throw new NotFoundException('Job opening not found');return prisma.jobOpening.update({where:{id},data:{status:'CLOSED',closedAt:new Date()}});}
  async listCandidates(req:any,q:any){const where:any={...tenantWhere(req.user?.tenantId)};if(q.jobOpeningId)where.jobOpeningId=q.jobOpeningId;if(q.stage)where.stage=q.stage;const data=await prisma.candidate.findMany({where,include:{jobOpening:{select:{code:true,title:true}}},orderBy:{createdAt:'desc'}});return{data,count:data.length};}
  async createCandidate(req:any,dto:any){const tenantId=req.user?.tenantId;const o=await prisma.jobOpening.findFirst({where:{...tenantWhere(tenantId),id:dto.jobOpeningId}});if(!o)throw new NotFoundException('Job opening not found');if(o.status!=='OPEN')throw new BadRequestException('Job opening is closed');if(await prisma.candidate.findFirst({where:{...tenantWhere(tenantId),jobOpeningId:dto.jobOpeningId,email:dto.email}}))throw new ConflictException('Candidate already exists for this opening');return prisma.candidate.create({data:{tenantId,...dto}});}
  async updateCandidate(req:any,id:string,dto:any){const c=await prisma.candidate.findFirst({where:{...tenantWhere(req.user?.tenantId),id}});if(!c)throw new NotFoundException('Candidate not found');if(c.stage==='HIRED')throw new BadRequestException('Hired candidate is locked');return prisma.candidate.update({where:{id},data:dto});}
  async hireCandidate(req:any,id:string,dto:any){
    const tenantId=req.user?.tenantId;
    if(!tenantId)throw new BadRequestException('Tenant is required');
    const hireDate=new Date(dto.hireDate);
    if(Number.isNaN(hireDate.getTime()))throw new BadRequestException('Invalid hire date');

    return prisma.$transaction(async tx=>{
      const c=await tx.candidate.findFirst({
        where:{...tenantWhere(tenantId),id},
        include:{jobOpening:true},
      });
      if(!c)throw new NotFoundException('Candidate not found');
      if(c.stage==='HIRED'||c.hiredEmployeeId)throw new ConflictException('Candidate already hired');
      if(c.stage!=='OFFER')throw new ConflictException('Candidate must be in OFFER stage before hiring');
      if(c.jobOpening.status!=='OPEN')throw new ConflictException('Job opening is closed');

      if(await tx.employee.findFirst({where:{...tenantWhere(tenantId),employeeCode:dto.employeeCode}})){
        throw new ConflictException('Employee code already exists');
      }

      const hiredCount=await tx.candidate.count({
        where:{tenantId,jobOpeningId:c.jobOpeningId,stage:'HIRED'},
      });
      if(hiredCount>=c.jobOpening.openings){
        throw new ConflictException('Job opening has reached its hiring capacity');
      }

      const e=await tx.employee.create({
        data:{
          tenantId,
          employeeCode:dto.employeeCode,
          firstName:c.firstName,
          lastName:c.lastName,
          email:c.email||undefined,
          phone:c.phone||undefined,
          departmentId:c.jobOpening.departmentId||null,
          jobTitle:c.jobOpening.title,
          employmentType:dto.employmentType||c.jobOpening.employmentType||'FULL_TIME',
          hireDate,
          basicSalary:dto.basicSalary??null,
        },
      });

      await tx.candidate.update({
        where:{id:c.id},
        data:{stage:'HIRED',hiredEmployeeId:e.id},
      });

      const tasks=defaultLifecycleTasks('ONBOARDING');
      await tx.hrLifecycleCase.create({
        data:{
          tenantId,
          employeeId:e.id,
          type:'ONBOARDING',
          status:'OPEN',
          startDate:hireDate,
          createdById:req.user?.userId||req.user?.id||null,
          tasks:{create:tasks.map(task=>({...task,tenantId}))},
        },
      });

      if(hiredCount+1>=c.jobOpening.openings){
        await tx.jobOpening.update({
          where:{id:c.jobOpeningId},
          data:{status:'CLOSED',closedAt:new Date()},
        });
      }

      return e;
    });
  }
}
